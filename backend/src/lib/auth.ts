import jwt from "jsonwebtoken";
import type { Response } from "express";
import { requireJwtSecret } from "./env.js";

export const cookieName = process.env.COOKIE_NAME ?? "atelier_session";
export const adminCookieName = process.env.ADMIN_COOKIE_NAME ?? "atelier_admin_session";
export type SessionPayload = { userId:string; role:"USER"|"ADMIN" };
function getSecret():string{return requireJwtSecret();}
function cookieOptions(maxAge:number){return {httpOnly:true,secure: process.env.NODE_ENV === "production",sameSite:"lax" as const,maxAge,path:"/",...(maxAge === 0 ? { expires: new Date(0) } : {}),...(process.env.COOKIE_DOMAIN?{domain:process.env.COOKIE_DOMAIN}:{})};}
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export function setSession(res:Response,payload:SessionPayload):void{const token=jwt.sign(payload,getSecret(),{expiresIn:"7d",issuer:"atelier"});const name=payload.role==="ADMIN"?adminCookieName:cookieName;res.cookie(name,token,cookieOptions(7*24*60*60*1000));if(payload.role==="ADMIN")clearSession(res);else clearAdminSession(res);}
/** Keep an actively used admin session alive for seven days from its latest request. */
export function refreshAdminSession(res:Response,payload:SessionPayload):void{if(payload.role!=="ADMIN")return;const token=jwt.sign(payload,getSecret(),{expiresIn:"7d",issuer:"atelier"});res.cookie(adminCookieName,token,cookieOptions(SESSION_MAX_AGE));}
export function clearSession(res:Response):void{res.clearCookie(cookieName,cookieOptions(0));res.clearCookie(cookieName,{path:"/",expires:new Date(0),maxAge:0});}
export function clearAdminSession(res:Response):void{res.clearCookie(adminCookieName,cookieOptions(0));res.clearCookie(adminCookieName,{path:"/",expires:new Date(0),maxAge:0});}
export function readToken(token?:string):SessionPayload|null{if(!token)return null;try{const decoded=jwt.verify(token,getSecret(),{issuer:"atelier"});if(typeof decoded!=="object"||decoded===null)return null;if(typeof decoded.userId!=="string")return null;if(decoded.role!=="USER"&&decoded.role!=="ADMIN")return null;return {userId:decoded.userId,role:decoded.role};}catch{return null;}}
export function readCustomerToken(token?:string){const s=readToken(token);return s?.role==="USER"?s:null;}
export function readAdminToken(token?:string){const s=readToken(token);return s?.role==="ADMIN"?s:null;}
