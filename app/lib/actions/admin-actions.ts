"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../utils/admin";
import { revalidatePath } from "next/cache";

// GET ALL POLLS (Admin only)
export async function getAllPolls() {
  const { error: adminError, isAdmin } = await requireAdmin();
  
  if (!isAdmin) {
    return { polls: [], error: adminError || "Unauthorized access" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { polls: [], error: "Failed to fetch polls" };
  }
  
  return { polls: data ?? [], error: null };
}

// DELETE ANY POLL (Admin only)
export async function adminDeletePoll(id: string) {
  const { error: adminError, isAdmin } = await requireAdmin();
  
  if (!isAdmin) {
    return { error: adminError || "Unauthorized access" };
  }

  if (!id || typeof id !== 'string') {
    return { error: "Invalid poll ID" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id);
  
  if (error) {
    return { error: "Failed to delete poll" };
  }
  
  revalidatePath("/admin");
  return { error: null };
}

// GET USER STATISTICS (Admin only)
export async function getUserStats() {
  const { error: adminError, isAdmin } = await requireAdmin();
  
  if (!isAdmin) {
    return { stats: null, error: adminError || "Unauthorized access" };
  }

  const supabase = await createClient();
  
  // Get total polls count
  const { count: pollsCount } = await supabase
    .from("polls")
    .select("*", { count: "exact", head: true });

  // Get total votes count  
  const { count: votesCount } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true });

  return {
    stats: {
      totalPolls: pollsCount ?? 0,
      totalVotes: votesCount ?? 0,
    },
    error: null,
  };
}