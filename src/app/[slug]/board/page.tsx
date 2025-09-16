'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabase-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Plus, 
  MessageSquare, 
  Calendar,
  User,
  LogOut,
  Settings,
  Home
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import Link from 'next/link';
import PostSubmissionForm from '@/components/PostSubmissionForm';
import VoteButton from '@/components/VoteButton';

interface Post {
  id: string;
  title: string;
  description?: string;
  author_email?: string;
  status: 'open' | 'planned' | 'in_progress' | 'done' | 'declined';
  created_at: string;
  vote_count: number;
  comment_count: number;
  user_voted: boolean;
}

interface Project {
  id: string;
  name: string;
  slug: string;
}

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  planned: { label: 'Planned', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  done: { label: 'Done', color: 'bg-green-100 text-green-800 border-green-200' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800 border-red-200' }
};

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const supabase = getSupabaseClient();
  
  const [project, setProject] = useState<Project | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('votes');
  const [showPostForm, setShowPostForm] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const loadProjectAndPosts = useCallback(async () => {
    if (!supabase) {
      setError('Database connection not available. Please refresh the page.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get project by slug
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', params.slug)
        .single();

      if (projectError) {
        toast.error('Project not found');
        router.push('/');
        return;
      }

      setProject(projectData);

      // Get board for this project
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('id')
        .eq('project_id', projectData.id)
        .single();

      if (boardError || !boardData) {
        toast.error('Board not found');
        return;
      }

      setBoardId(boardData.id);

      // Build query for posts
      let postsQuery = supabase
        .from('posts')
        .select(`
          *,
          vote_count:votes(count),
          comment_count:comments(count)
        `)
        .eq('board_id', boardData.id)
        .is('duplicate_of', null); // Don't show duplicate posts

      // Apply status filter
      if (statusFilter !== 'all') {
        postsQuery = postsQuery.eq('status', statusFilter);
      }

      // Apply sorting
      if (sortBy === 'votes') {
        postsQuery = postsQuery.order('vote_count', { ascending: false });
      } else if (sortBy === 'newest') {
        postsQuery = postsQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'oldest') {
        postsQuery = postsQuery.order('created_at', { ascending: true });
      }

      const { data: postsData, error: postsError } = await postsQuery;

      if (postsError) {
        console.error('Error loading posts:', postsError);
        toast.error('Error loading posts');
        return;
      }

      // Process posts data
      const processedPosts = postsData?.map((post: Record<string, unknown>) => ({
        id: post.id as string,
        title: post.title as string,
        description: post.description as string,
        author_email: post.author_email as string,
        status: post.status as 'open' | 'planned' | 'in_progress' | 'done' | 'declined',
        created_at: post.created_at as string,
        vote_count: (post.vote_count as Array<{count: number}>)?.[0]?.count || 0,
        comment_count: (post.comment_count as Array<{count: number}>)?.[0]?.count || 0,
        user_voted: false // TODO: Check if current user voted
      })) || [];

      setPosts(processedPosts);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [params.slug, statusFilter, sortBy, supabase, router]);

  // Load project and posts
  useEffect(() => {
    loadProjectAndPosts();
  }, [loadProjectAndPosts]);

  // Filter posts by search term
  const filteredPosts = posts.filter((post: Post) =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Link href="/app" className="hover:text-gray-900 flex items-center gap-1">
                <Home className="w-4 h-4" />
                Dashboard
              </Link>
              <span>→</span>
              <span>{project?.name}</span>
              <span>→</span>
              <span>Feedback Board</span>
            </div>
            
            {/* User Actions */}
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{user.email}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {project?.name} Feedback
              </h1>
              <p className="text-gray-600 mt-1">
                Share your ideas and help us build better features
              </p>
            </div>
            
            <div className="flex gap-2">
              {user && (
                <Link href={`/${params.slug}/settings`}>
                  <Button variant="outline" className="flex items-center gap-1">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </Link>
              )}
              <Link href={`/${params.slug}/roadmap`}>
                <Button variant="outline" className="flex items-center gap-1">
                  View Roadmap
                </Button>
              </Link>
              <Button 
                onClick={() => setShowPostForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Submit Feedback
              </Button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search feedback..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="votes">Most Votes</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Posts List */}
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No feedback yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Be the first to share your ideas and help shape the future of this product.
                </p>
                <Button 
                  onClick={() => setShowPostForm(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Submit First Feedback
                </Button>
              </div>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <Card 
                key={post.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/${params.slug}/post/${post.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Vote Button */}
                    <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                      <VoteButton
                        postId={post.id}
                        initialVoteCount={post.vote_count}
                        initialUserVoted={post.user_voted}
                        onVoteChange={(newCount, userVoted) => {
                          // Update the post in the local state
                          setPosts(prev => prev.map(p => 
                            p.id === post.id 
                              ? { ...p, vote_count: newCount, user_voted: userVoted }
                              : p
                          ));
                        }}
                        onShowNotification={(message, type) => {
                          if (type === 'success') {
                            toast.success(message);
                          } else if (type === 'error') {
                            toast.error(message);
                          } else {
                            toast.info(message);
                          }
                        }}
                        size="md"
                        variant="default"
                      />
                    </div>

                    {/* Post Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                          {post.title}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={statusConfig[post.status].color}
                        >
                          {statusConfig[post.status].label}
                        </Badge>
                      </div>

                      {post.description && (
                        <p className="text-gray-600 line-clamp-3 mb-3">
                          {post.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>
                            {post.author_email ? 
                              post.author_email.split('@')[0] : 
                              'Anonymous'
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{post.comment_count} comments</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Show more button if needed */}
        {filteredPosts.length > 0 && (
          <div className="text-center mt-8">
            <Button variant="outline">
              Load More Feedback
            </Button>
          </div>
        )}
      </div>

      {/* Post Submission Modal */}
      {showPostForm && project && boardId && (
        <PostSubmissionForm
          isOpen={showPostForm}
          onClose={() => setShowPostForm(false)}
          projectId={project.id}
          boardId={boardId}
          onPostSubmitted={loadProjectAndPosts}
        />
      )}
    </div>
  );
}