# School Management System Demo Script

## Introduction (1 minute)
- Welcome to the School Management System demo
- This system manages educational data including municipalities, schools, teachers, students, courses, class groups, assignments, and submissions
- Built with Node.js, TypeScript, PostgreSQL, and Azure Blob Storage

## System Architecture (1 minute)
- Show system architecture diagram
- Highlight key components:
  - RESTful API with OpenAPI specification
  - PostgreSQL database for relational data
  - Azure Blob Storage for submission artifacts
  - Authentication and rate limiting middleware

## Database Structure (1 minute)
- Demonstrate the database schema
- Explain relationships between entities
- Show how data is seeded from CSV files

## API Demonstration (5 minutes)

### 1. Authentication (30 seconds)
- Show API key authentication
- Demonstrate rate limiting protection

### 2. Municipality and School Management (1 minute)
- List municipalities
- Show schools within a municipality
- Retrieve detailed school information

### 3. Teacher and Student Management (1 minute)
- List teachers at a school
- Show class groups taught by a teacher
- List students and their enrollments

### 4. Course and Class Group Management (1 minute)
- Browse available courses
- Show class groups for a course
- View students enrolled in a class group

### 5. Assignment and Submission Workflow (1.5 minutes)
- Create a new assignment
- Show submission process with artifact upload
- Demonstrate artifact retrieval with SAS URL

## Technical Highlights (1.5 minutes)
- Data validation and error handling
- Blob storage integration for artifacts
- OpenAPI documentation with Swagger UI
- Security features (authentication, rate limiting)

## Conclusion (30 seconds)
- Summarize system capabilities
- Highlight extensibility and scalability
- Q&A

## Demo Preparation Checklist

1. Ensure Docker containers are running:
   ```
   docker-compose up -d
   ```

2. Verify database is seeded:
   ```
   npm run db:seed
   ```

3. Start the application:
   ```
   npm run dev
   ```

4. Prepare API client (Postman or similar) with:
   - Environment variables set up
   - API key configured
   - Request collections ready

5. Have sample files ready for submission upload demo

## Demo Flow Commands

### Authentication
```
curl -X GET http://localhost:3000/api/v1/municipalities \
  -H "X-API-KEY: your-secure-api-key"
```

### Municipality and School Endpoints
```
# List all municipalities
curl -X GET http://localhost:3000/api/v1/municipalities \
  -H "X-API-KEY: your-secure-api-key"

# Get schools in municipality
curl -X GET http://localhost:3000/api/v1/municipalities/1/schools \
  -H "X-API-KEY: your-secure-api-key"
```

### School Endpoints
```
# Get school details
curl -X GET http://localhost:3000/api/v1/schools/1 \
  -H "X-API-KEY: your-secure-api-key"

# Get teachers at school
curl -X GET http://localhost:3000/api/v1/schools/1/teachers \
  -H "X-API-KEY: your-secure-api-key"
```

### Teacher and Student Endpoints
```
# Get teacher details
curl -X GET http://localhost:3000/api/v1/teachers/1 \
  -H "X-API-KEY: your-secure-api-key"

# Get student details
curl -X GET http://localhost:3000/api/v1/students/1 \
  -H "X-API-KEY: your-secure-api-key"
```

### Course and Class Group Endpoints
```
# List all courses
curl -X GET http://localhost:3000/api/v1/courses \
  -H "X-API-KEY: your-secure-api-key"

# Get class groups for course
curl -X GET http://localhost:3000/api/v1/courses/1/class-groups \
  -H "X-API-KEY: your-secure-api-key"
```

### Assignment and Submission Endpoints
```
# Get assignments for class group
curl -X GET http://localhost:3000/api/v1/class-groups/1/assignments \
  -H "X-API-KEY: your-secure-api-key"

# Get submissions for assignment
curl -X GET http://localhost:3000/api/v1/assignments/1/submissions \
  -H "X-API-KEY: your-secure-api-key"
```

### File Upload Demo
```
# Create new submission with file upload
curl -X POST http://localhost:3000/api/v1/submissions \
  -H "X-API-KEY: your-secure-api-key" \
  -F "student_id=1" \
  -F "assignment_id=1" \
  -F "artifact=@/path/to/sample/file.docx"
```

### Get Artifact URL
```
# Get SAS URL for artifact
curl -X GET http://localhost:3000/api/v1/submissions/1/artifact-url \
  -H "X-API-KEY: your-secure-api-key"
```

## Fallback Scenarios

If any demo component fails, have these alternatives ready:

1. Pre-recorded API responses
2. Screenshots of expected results
3. Sample data in JSON format to explain the structure