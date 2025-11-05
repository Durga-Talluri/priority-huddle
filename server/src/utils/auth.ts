// server/src/utils/auth.ts

import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User, IUser } from "../models/User";
import { JWT_SECRET } from "./config";

const SALT_ROUNDS = 10; // Standard security measure
interface AuthPayload extends JwtPayload {
  userId: string;
}
// Hashing the password for security
export const hashPassword = async (password: string): Promise<string> => {
  // Why: We must never store raw passwords. Hashing is a one-way process
  // that converts the password into an unreadable string (the hash).
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Comparing the password during login
export const comparePasswords = async (
  password: string,
  hash: string
): Promise<boolean> => {
  // Why: We compare the hash of the *entered* password with the stored hash.
  return bcrypt.compare(password, hash);
};

// Generating a JSON Web Token (JWT)
export const createToken = (user: IUser): string => {
  // Why: The JWT is the proof of identity. It's a signed, encrypted string that contains
  // minimal user data (like the ID) and is sent with every subsequent request.
  const payload = {
    id: user._id,
    email: user.email,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" }); // Token expires in 7 days
};

// Decoding and validating the token on subsequent requests
export const getUserFromToken = async (
  authHeader: string
): Promise<IUser | null> => {
  try {
    if (!authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);

    // 1. Verify and decode the token, casting it to the specific AuthPayload interface
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;

    // 2. Access userId directly (we now guarantee it exists if verification succeeded)
    const userId = decoded.userId; // <-- FIXED access

    if (!userId) {
      return null;
    }

    // 3. Fetch the user from the database
    const user = await User.findById(userId);
  

    return user;
  } catch (error) {
    console.error("JWT Error:", (error as Error).message);
    return null;
  }
};
