"use server";

import { redirect } from "next/navigation";
export async function signOutAction() {
  // Public demo mode: auth is disabled.
  redirect("/");
}

