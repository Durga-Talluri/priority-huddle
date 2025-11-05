// server/src/utils/config.ts
// Best practice: Read this from a .env file, but we'll hardcode for now to ensure it runs.

export const JWT_SECRET = process.env.JWT_SECRET_kEY as string;
// !!! Change this key for any real deployment !!!
