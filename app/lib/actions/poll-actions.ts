"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { votingRateLimiter, createPollRateLimiter, getClientIdentifier } from "../utils/rate-limiter";

// CREATE POLL
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  // Get user from session first for rate limiting
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: "Authentication failed" };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  // Rate limiting for poll creation
  const rateLimitResult = createPollRateLimiter.check(user.id);
  if (!rateLimitResult.allowed) {
    return { error: "Too many polls created. Please try again later." };
  }

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  // Input validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return { error: "Question is required." };
  }
  if (question.length > 500) {
    return { error: "Question must be less than 500 characters." };
  }
  if (options.length < 2) {
    return { error: "Please provide at least two options." };
  }
  if (options.length > 10) {
    return { error: "Maximum 10 options allowed." };
  }
  
  // Validate and sanitize options
  const sanitizedOptions = options
    .map(option => typeof option === 'string' ? option.trim() : '')
    .filter(option => option.length > 0);
    
  if (sanitizedOptions.length < 2) {
    return { error: "Please provide at least two valid options." };
  }
  
  // Check option length
  for (const option of sanitizedOptions) {
    if (option.length > 200) {
      return { error: "Each option must be less than 200 characters." };
    }
  }

  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question: question.trim(),
      options: sanitizedOptions,
    },
  ]);

  if (error) {
    return { error: "Failed to create poll. Please try again." };
  }

  revalidatePath("/polls");
  return { error: null };
}

// GET USER POLLS
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID
export async function getPollById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

// SUBMIT VOTE
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();

  // Input validation
  if (!pollId || typeof pollId !== 'string') {
    return { error: "Invalid poll ID." };
  }
  if (typeof optionIndex !== 'number' || optionIndex < 0) {
    return { error: "Invalid option selected." };
  }

  // Get request headers for rate limiting
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const forwarded = headersList.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0] || headersList.get('x-real-ip') || 'unknown';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Create identifier for rate limiting
  const rateLimitId = user ? user.id : getClientIdentifier(userAgent, ip);
  
  // Rate limiting for voting
  const rateLimitResult = votingRateLimiter.check(rateLimitId);
  if (!rateLimitResult.allowed) {
    return { error: "Too many votes submitted. Please try again later." };
  }

  // Verify poll exists and get poll details
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("*")
    .eq("id", pollId)
    .single();

  if (pollError || !poll) {
    return { error: "Poll not found." };
  }

  // Validate option index is within range
  if (optionIndex >= poll.options.length) {
    return { error: "Invalid option selected." };
  }

  // For authenticated users, check if they already voted
  if (user) {
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", pollId)
      .eq("user_id", user.id)
      .single();

    if (existingVote) {
      return { error: "You have already voted on this poll." };
    }
  } else {
    // For anonymous users, check by IP (basic protection)
    const { data: existingVotes } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", pollId)
      .is("user_id", null);

    // Simple check - in production, you'd want more sophisticated duplicate detection
    if (existingVotes && existingVotes.length > 10) {
      return { error: "Too many anonymous votes from this source." };
    }
  }

  // Insert the vote
  const { error } = await supabase.from("votes").insert([
    {
      poll_id: pollId,
      user_id: user?.id ?? null,
      option_index: optionIndex,
    },
  ]);

  if (error) {
    return { error: "Failed to submit vote. Please try again." };
  }

  return { error: null };
}

// DELETE POLL
export async function deletePoll(id: string) {
  const supabase = await createClient();

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: "Authentication failed" };
  }
  if (!user) {
    return { error: "You must be logged in to delete a poll." };
  }

  // Only allow deleting polls owned by the user
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  
  if (error) {
    return { error: "Failed to delete poll or poll not found" };
  }
  
  revalidatePath("/polls");
  return { error: null };
}

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  // Input validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return { error: "Question is required." };
  }
  if (question.length > 500) {
    return { error: "Question must be less than 500 characters." };
  }
  if (options.length < 2) {
    return { error: "Please provide at least two options." };
  }
  if (options.length > 10) {
    return { error: "Maximum 10 options allowed." };
  }
  
  // Validate and sanitize options
  const sanitizedOptions = options
    .map(option => typeof option === 'string' ? option.trim() : '')
    .filter(option => option.length > 0);
    
  if (sanitizedOptions.length < 2) {
    return { error: "Please provide at least two valid options." };
  }
  
  // Check option length
  for (const option of sanitizedOptions) {
    if (option.length > 200) {
      return { error: "Each option must be less than 200 characters." };
    }
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: "Authentication failed" };
  }
  if (!user) {
    return { error: "You must be logged in to update a poll." };
  }

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from("polls")
    .update({ question: question.trim(), options: sanitizedOptions })
    .eq("id", pollId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Failed to update poll or poll not found." };
  }

  return { error: null };
}
