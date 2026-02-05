import "dotenv/config";
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { getDb, closeDbIfAny } from '../core/db/pool';

// Define the order of tables for seeding (respecting foreign key constraints)
const tableOrder = [
  'municipality',
  'school',
  'teacher',
  'student',
  'course',
  'class_group',
  'enrolment',
  'assignment',
  'submission'
];

console.log("DB:", process.env.DATABASE_URL);

// Define foreign key relationships for validation
const foreignKeys: Record<string, { column: string; refTable: string; refColumn: string }[]> = {
  school: [{ column: 'municipality_id', refTable: 'municipality', refColumn: 'id' }],
  teacher: [{ column: 'school_id', refTable: 'school', refColumn: 'id' }],
  student: [{ column: 'school_id', refTable: 'school', refColumn: 'id' }],
  class_group: [
    { column: 'course_id', refTable: 'course', refColumn: 'id' },
    { column: 'teacher_id', refTable: 'teacher', refColumn: 'id' },
    { column: 'school_id', refTable: 'school', refColumn: 'id' }
  ],
  enrolment: [
    { column: 'student_id', refTable: 'student', refColumn: 'id' },
    { column: 'class_group_id', refTable: 'class_group', refColumn: 'id' }
  ],
  assignment: [{ column: 'class_group_id', refTable: 'class_group', refColumn: 'id' }],
  submission: [
    { column: 'assignment_id', refTable: 'assignment', refColumn: 'id' },
    { column: 'student_id', refTable: 'student', refColumn: 'id' }
  ]
};

// Define unique constraints for validation
const uniqueColumns: Record<string, string[]> = {
  municipality: ['code'],
  school: ['code'],
  teacher: ['email'],
  student: ['email'],
  course: ['code'],
  class_group: ['code'],
  // FIX: composite must be one string, not two separate singles
  enrolment: ['student_id,class_group_id'],
  assignment: ['code'],
  submission: ['code', 'assignment_id,student_id']
};

// Cache for foreign key validation
const idCache: Record<string, Set<string>> = {};

/**
 * Parse CSV file and return rows as objects
 */
async function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv()) // FIX: use csv() transformer
      .on('data', (data: any) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error: any) => reject(error));
  });
}

/**
 * Validate foreign key constraints
 */
function validateForeignKeys(table: string, rows: any[]): string[] {
  const errors: string[] = [];

  if (!foreignKeys[table]) {
    return errors;
  }

  for (const row of rows) {
    for (const fk of foreignKeys[table]) {
      const foreignKeyValue = row[fk.column];

      // FIX: proper computed key with template string
      if (foreignKeyValue && !idCache[`${fk.refTable}_${fk.refColumn}`]?.has(String(foreignKeyValue))) {
        errors.push(
          `Foreign key violation in ${table}: ${fk.column}=${foreignKeyValue} does not exist in ${fk.refTable}.${fk.refColumn}`
        );
      }
    }
  }

  return errors;
}

/**
 * Validate unique constraints
 */
function validateUniqueConstraints(table: string, rows: any[]): string[] {
  const errors: string[] = [];

  if (!uniqueColumns[table]) {
    return errors;
  }

  for (const uniqueCol of uniqueColumns[table]) {
    const seen = new Set<string>();
    const isComposite = uniqueCol.includes(',');

    if (isComposite) {
      const columns = uniqueCol.split(',').map(s => s.trim());

      for (const row of rows) {
        const compositeKey = columns.map(col => row[col]).join('_');

        if (seen.has(compositeKey)) {
          errors.push(
            `Unique constraint violation in ${table}: Composite key (${uniqueCol}) with value (${compositeKey}) is duplicated`
          );
        }

        seen.add(compositeKey);
      }
    } else {
      for (const row of rows) {
        const value = row[uniqueCol];

        if (value && seen.has(value)) {
          errors.push(
            `Unique constraint violation in ${table}: ${uniqueCol}=${value} is duplicated`
          );
        }

        if (value) {
          seen.add(value);
        }
      }
    }
  }

  return errors;
}

/**
 * Update ID cache for foreign key validation
 */
function updateIdCache(table: string, column: string, rows: any[]): void {
  // FIX: proper key string
  const cacheKey = `${table}_${column}`;
  idCache[cacheKey] = new Set(rows.map(row => String(row[column])));
}

/**
 * Seed a table from CSV file
 */
async function seedTable(table: string): Promise<void> {
  const filePath = path.join(__dirname, '..', 'data', `${table}.csv`); // kept your path style

  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${table}: CSV file not found`);
    return;
  }

  try {
    console.log(`Seeding ${table}...`);

    // Parse CSV file
    const rows = await parseCSV(filePath);

    // Validate foreign keys
    const fkErrors = validateForeignKeys(table, rows);
    if (fkErrors.length > 0) {
      console.error(`Foreign key validation errors in ${table}:`);
      fkErrors.forEach(err => console.error(`- ${err}`));
      throw new Error(`Foreign key validation failed for ${table}`);
    }

    // Validate unique constraints
    const uniqueErrors = validateUniqueConstraints(table, rows);
    if (uniqueErrors.length > 0) {
      console.error(`Unique constraint validation errors in ${table}:`);
      uniqueErrors.forEach(err => console.error(`- ${err}`));
      throw new Error(`Unique constraint validation failed for ${table}`);
    }

    // Insert rows
    const db = getDb(); // FIX: use your pool
    for (const row of rows) {
      const columns = Object.keys(row);
      const values = Object.values(row).map(v => (v === '' ? null : v)); // keep empty as null
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `;

      await db.query(query, values);
    }

    // Update ID cache for foreign key validation
    if (rows.length && 'id' in rows[0]) {
      updateIdCache(table, 'id', rows);
    }

    console.log(`Successfully seeded ${rows.length} rows into ${table}`);
  } catch (error) {
    console.error(`Error seeding ${table}:`, error);
    throw error;
  }
}

/**
 * Initialize database schema
 */
async function initSchema(): Promise<void> {
  try {
    console.log('Initializing database schema...');
    const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.log('No schema.sql found, skipping schema init');
      return;
    }
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await getDb().query(schema); // kept same behavior (no tx), but via getDb()
    console.log('Schema initialized successfully');
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  }
}

/**
 * Main seed function
 */
async function seed(): Promise<void> {
  try {
    // Initialize schema
    await initSchema();

    // Seed tables in order
    for (const table of tableOrder) {
      await seedTable(table);
    }

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await closeDbIfAny(); // FIX: cleanly close the pool if it was created
  }
}

// Run the seed function
seed();