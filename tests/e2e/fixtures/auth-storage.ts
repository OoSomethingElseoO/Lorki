// Path to the admin session storageState written by auth.setup.ts. Kept in
// its own (non-test) module so spec files can import the constant without
// importing auth.setup.ts itself — Playwright refuses to let a spec file
// import another test file.
export const ADMIN_STORAGE_STATE = "tests/e2e/.auth/admin.json";
