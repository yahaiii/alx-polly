"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllPolls, adminDeletePoll, getUserStats } from "@/app/lib/actions/admin-actions";
import { useAuth } from "@/app/lib/context/auth-context";
import { toast } from "sonner";

interface Poll {
  id: string;
  question: string;
  user_id: string;
  created_at: string;
  options: string[];
}

interface Stats {
  totalPolls: number;
  totalVotes: number;
}

export default function AdminPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      checkAdminAccess();
    }
  }, [user, authLoading, router]);

  const checkAdminAccess = async () => {
    try {
      const [pollsResult, statsResult] = await Promise.all([
        getAllPolls(),
        getUserStats()
      ]);

      if (pollsResult.error) {
        toast.error("Unauthorized access to admin panel");
        router.push("/polls");
        return;
      }

      setPolls(pollsResult.polls || []);
      setStats(statsResult.stats);
      setIsAuthorized(true);
    } catch (error) {
      toast.error("Failed to load admin data");
      router.push("/polls");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm("Are you sure you want to delete this poll?")) {
      return;
    }

    setDeleteLoading(pollId);
    const result = await adminDeletePoll(pollId);

    if (result.error) {
      toast.error(result.error);
    } else {
      setPolls(polls.filter((poll) => poll.id !== pollId));
      toast.success("Poll deleted successfully");
    }

    setDeleteLoading(null);
  };

  if (authLoading || loading) {
    return <div className="p-6">Loading admin panel...</div>;
  }

  if (!isAuthorized) {
    return <div className="p-6">Unauthorized access</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-600 mt-2">
          View and manage all polls in the system.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Polls</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalPolls}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Votes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalVotes}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4">
        {polls.map((poll) => (
          <Card key={poll.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{poll.question}</CardTitle>
                  <CardDescription>
                    <div className="space-y-1 mt-2">
                      <div>
                        Poll ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.id}
                        </code>
                      </div>
                      <div>
                        Owner ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.user_id}
                        </code>
                      </div>
                      <div>
                        Created:{" "}
                        {new Date(poll.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(poll.id)}
                  disabled={deleteLoading === poll.id}
                >
                  {deleteLoading === poll.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="font-medium">Options:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {poll.options.map((option, index) => (
                    <li key={index} className="text-gray-700">
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {polls.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No polls found in the system.
        </div>
      )}
    </div>
  );
}