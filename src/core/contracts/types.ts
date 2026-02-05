/**
 * Thin, stable re-exports of OpenAPI-generated schema types.
 *
 * Why:
 * - Let the rest of the codebase import simple names like `Course`, `User`, etc.
 * - If the generator output path changes, only this file needs updating.
 *
 * Source:
 * - Types come from the generated file: `src/contracts/openapi/types.d.ts`
 *   (produced by openapi-typescript from `api/contracts/openapi.yml`).
 */

import { components } from "./openapi/types";

export type Course = components["schemas"]["Course"];
export type User = components["schemas"]["User"];
export type Assignment = components["schemas"]["Assignment"];
export type Grade = components["schemas"]["Grade"];

export type CourseList = components["schemas"]["CourseList"];
export type UserList = components["schemas"]["UserList"];
export type AssignmentList = components["schemas"]["AssignmentList"];
export type GradeList = components["schemas"]["GradeList"];

export type Submission     = components["schemas"]["Submission"];
export type SubmissionList = components["schemas"]["SubmissionList"];