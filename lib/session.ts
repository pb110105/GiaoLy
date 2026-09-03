import "server-only";

import {
  JWTPayload,
  jwtVerify,
  SignJWT,
} from "jose";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("Thiếu SESSION_SECRET trong .env.local");
}

const secretKey = new TextEncoder().encode(sessionSecret);

export const SESSION_COOKIE_NAME = "giaoly_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

export type SessionPayload = JWTPayload & {
  phone: string;
  email: string;
  role: string;
};

type AccountForSession = {
  id: string;
  phone: string;
  email: string;
  role: string;
};

export async function createSessionToken(
  account: AccountForSession,
) {
  return new SignJWT({
    phone: account.phone,
    email: account.email,
    role: account.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });

  return payload as SessionPayload;
}