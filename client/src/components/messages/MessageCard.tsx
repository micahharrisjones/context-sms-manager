import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { X, Edit, ExternalLink, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { EditMessageModal } from "./EditMessageModal";

interface MessageCardProps {
  message: Message;
}

function getInstagramPostId(url: string): string | null {
  // Handle posts, reels, and other Instagram content
  const postMatch = url.match(/instagram\.com\/p\/([^/?]+)/);
  if (postMatch) return postMatch[1];
  
  const reelMatch = url.match(/instagram\.com\/reel\/([^/?]+)/);
  if (reelMatch) return reelMatch[1];
  
  return null;
}

// Pinterest removed - using Open Graph preview instead

function getTwitterPostId(url: string): string | null {
  // Match both x.com and twitter.com
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

function getRedditPostInfo(url: string): { subreddit: string; postId: string } | null {
  // Handle standard Reddit post URLs with comments
  const commentsMatch = url.match(/reddit\.com\/r\/(\w+)\/comments\/([^/?]+)/);
  if (commentsMatch) return { subreddit: commentsMatch[1], postId: commentsMatch[2] };
  
  // Handle old Reddit URLs
  const oldMatch = url.match(/old\.reddit\.com\/r\/(\w+)\/comments\/([^/?]+)/);
  if (oldMatch) return { subreddit: oldMatch[1], postId: oldMatch[2] };
  
  return null;
}

function getFacebookPostId(url: string): string | null {
  const match = url.match(/facebook\.com\/.*\/posts\/(\d+)|facebook\.com\/permalink\.php\?story_fbid=(\d+)/);
  return match ? (match[1] || match[2]) : null;
}

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function getTikTokVideoId(url: string): string | null {
  // Handle various TikTok URL formats
  const videoMatch = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (videoMatch) return videoMatch[1];
  
  // Handle vm.tiktok.com short URLs
  const vmMatch = url.match(/vm\.tiktok\.com\/([^/?]+)/);
  if (vmMatch) return vmMatch[1];
  
  // Handle tiktok.com/t/ short URLs
  const shortMatch = url.match(/tiktok\.com\/t\/([^/?]+)/);
  if (shortMatch) return shortMatch[1];
  
  return null;
}

function getIMDbInfo(url: string): { type: string; id: string } | null {
  // Match IMDB URLs for movies and TV shows
  const movieMatch = url.match(/imdb\.com\/title\/(tt\d+)/);
  if (movieMatch) {
    return { type: 'title', id: movieMatch[1] };
  }
  return null;
}

// Extract all URLs from message content
function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = content.match(urlRegex);
  return matches || [];
}

// Check if URL should get Open Graph preview (not already handled by social embeds)
function shouldFetchOpenGraph(url: string, hasSpecificEmbed: boolean = false): boolean {
  try {
    const urlObj = new URL(url);
    
    // If we already have a specific embed (Instagram, TikTok, etc.), don't fetch Open Graph
    if (hasSpecificEmbed) {
      return false;
    }
    
    // Always allow Open Graph for social media URLs when specific embed extraction fails
    // This provides fallback previews for unsupported URL formats
    const alwaysSkipDomains = [
      'youtube.com',
      'youtu.be',
      'imdb.com', // We have custom TMDB integration
    ];
    
    return !alwaysSkipDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Helper function to format sender display (phone number or fallback)
function formatSenderDisplay(senderId: string): string {
  // Check if senderId is a phone number (starts with + and contains digits)
  if (senderId.match(/^\+?\d+$/)) {
    // It's a phone number, format it
    const digits = senderId.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return senderId; // Return as-is if unrecognized format
  }
  
  // If it's not a phone number (e.g., "user-31"), show "You" or fallback
  if (senderId.startsWith('user-')) {
    return 'You';
  }
  
  return senderId; // Fallback for other formats
}

// Helper function to get initials from senderId
function getSenderInitials(senderId?: string): React.ReactNode {
  if (!senderId) {
    return <User className="h-3 w-3" />;
  }
  
  // For phone numbers, use last 4 digits' first digit
  if (senderId.match(/^\+?\d+$/)) {
    const lastFour = senderId.replace(/\D/g, '').slice(-4);
    return lastFour[0] || <User className="h-3 w-3" />;
  }
  
  // For user IDs like "user-31", show "Y" for "You"
  if (senderId.startsWith('user-')) {
    return 'Y';
  }
  
  // Fallback to first character or icon
  return senderId[0]?.toUpperCase() || <User className="h-3 w-3" />;
}

interface MovieData {
  posterUrl: string | null;
  title: string | null;
  year: string | null;
  rating: number | null;
  genres: string[] | null;
}

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  site_name?: string;
  type?: string;
}

export function MessageCard({ message }: MessageCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [movieData, setMovieData] = useState<MovieData | null>(null);
  const [isLoadingMovie, setIsLoadingMovie] = useState(false);
  const [ogData, setOgData] = useState<OpenGraphData | null>(null);
  const [isLoadingOg, setIsLoadingOg] = useState(false);
  const [twitterOgData, setTwitterOgData] = useState<OpenGraphData | null>(null);
  const [isLoadingTwitterOg, setIsLoadingTwitterOg] = useState(false);

  // Extract hashtags and content separately
  const words = message.content.split(" ");
  const hashtags: string[] = [];
  const contentWithoutHashtags: string[] = [];
  
  words.forEach(word => {
    if (word.startsWith("#") && /^#[\w-]+$/.test(word)) {
      hashtags.push(word);
    } else {
      contentWithoutHashtags.push(word);
    }
  });
  
  const instagramPostId = message.content ? getInstagramPostId(message.content) : null;
  // Pinterest removed - using Open Graph preview instead
  const twitterPostId = message.content ? getTwitterPostId(message.content) : null;
  const redditPostInfo = message.content ? getRedditPostInfo(message.content) : null;
  const facebookPostId = message.content ? getFacebookPostId(message.content) : null;
  const youtubeVideoId = message.content ? getYouTubeVideoId(message.content) : null;
  const tiktokVideoId = message.content ? getTikTokVideoId(message.content) : null;
  const imdbInfo = message.content ? getIMDbInfo(message.content) : null;
  
  // Extract URLs for Open Graph previews
  const urls = extractUrls(message.content);
  
  // Check each URL individually for specific embeds instead of message-wide check
  const previewUrl = urls.find(url => {
    const hasUrlSpecificEmbed = !!(
      getInstagramPostId(url) ||
      getTwitterPostId(url) ||
      getRedditPostInfo(url) ||
      getFacebookPostId(url) ||
      getYouTubeVideoId(url) ||
      getTikTokVideoId(url) ||
      getIMDbInfo(url)
    );
    return shouldFetchOpenGraph(url, hasUrlSpecificEmbed);
  }) || null;
  
  // Check if the preview URL is a Pinterest URL
  const isPinterestUrl = previewUrl && (previewUrl.includes('pinterest.com') || previewUrl.includes('pin.it'));

  // Check if a URL has a rich preview (social media embed, IMDB, Open Graph)
  const hasRichPreview = (url: string): boolean => {
    return !!(
      getInstagramPostId(url) ||
      getTwitterPostId(url) ||
      getRedditPostInfo(url) ||
      getFacebookPostId(url) ||
      getYouTubeVideoId(url) ||
      getTikTokVideoId(url) ||
      getIMDbInfo(url) ||
      (previewUrl && url === previewUrl)
    );
  };

  // Format the content without hashtags and hide URLs that have rich previews
  const formattedContent = contentWithoutHashtags.map((word, i) => {
    // Check if the word is a URL
    try {
      new URL(word);
      
      // Hide URLs that have rich previews
      if (hasRichPreview(word)) {
        return null;
      }
      
      return (
        <a
          key={i}
          href={word}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {word}{" "}
        </a>
      );
    } catch {
      return word + " ";
    }
  }).filter(Boolean); // Remove null entries
  
  // Format hashtags for display at bottom
  const formattedHashtags = hashtags.map((hashtag, i) => (
    <Link
      key={i}
      href={`/tag/${hashtag.slice(1)}`}
      className="text-primary hover:underline"
    >
      {hashtag}
    </Link>
  ));
  

  // Fetch movie data from TMDB when IMDB link is detected
  useEffect(() => {
    async function fetchMovieData() {
      if (!imdbInfo) {
        setMovieData(null);
        return;
      }
      
      setIsLoadingMovie(true);
      
      try {
        const response = await fetch(`/api/tmdb/movie/${imdbInfo.id}`);
        if (response.ok) {
          const data = await response.json();
          setMovieData(data);
        }
      } catch (error) {
        console.error('Error fetching movie data:', error);
      } finally {
        setIsLoadingMovie(false);
      }
    }

    fetchMovieData();
  }, [imdbInfo?.id]);

  // Fetch Open Graph data for general URLs
  useEffect(() => {
    async function fetchOpenGraphData() {
      if (!previewUrl) {
        setOgData(null);
        return;
      }
      
      setIsLoadingOg(true);
      
      try {
        const response = await fetch(`/api/og-preview?url=${encodeURIComponent(previewUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (!data.skip && !data.error) {
            setOgData(data);
          }
        }
      } catch (error) {
        console.error('Error fetching Open Graph data:', error);
      } finally {
        setIsLoadingOg(false);
      }
    }

    fetchOpenGraphData();
  }, [previewUrl]);

  // Fetch Open Graph data for Twitter URLs to get post titles
  useEffect(() => {
    async function fetchTwitterOpenGraphData() {
      if (!twitterPostId) {
        setTwitterOgData(null);
        return;
      }
      
      const twitterUrl = urls.find(url => getTwitterPostId(url));
      if (!twitterUrl) return;
      
      setIsLoadingTwitterOg(true);
      
      try {
        const response = await fetch(`/api/og-preview?url=${encodeURIComponent(twitterUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (!data.skip && !data.error) {
            setTwitterOgData(data);
          }
        }
      } catch (error) {
        console.error('Error fetching Twitter Open Graph data:', error);
      } finally {
        setIsLoadingTwitterOg(false);
      }
    }

    fetchTwitterOpenGraphData();
  }, [twitterPostId, urls]);

  return (
    <>
      <Card className="w-full h-fit relative group">
        
      <CardContent className="space-y-4 pt-6">
        {/* Open Graph Preview - Show first */}
        {ogData && ogData.title && (
          <div className="w-full">
            <div className={`border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow ${
              isPinterestUrl 
                ? 'border-red-200 bg-gradient-to-br from-red-50 to-pink-50' 
                : 'border-[#e3cac0]'
            }`}>
              <a 
                href={previewUrl || ogData.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                {ogData.image && (
                  <div className="aspect-video w-full bg-gray-100 overflow-hidden">
                    <img
                      src={ogData.image}
                      alt={ogData.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4">
                  {isPinterestUrl ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.562-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.888-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.357-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.001 24c6.624 0 11.999-5.373 11.999-12C24 5.372 18.626.001 12.001.001z"/>
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full uppercase tracking-wide">PINTEREST</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-red-500 flex-shrink-0" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">
                          {ogData.title}
                        </h3>
                        {ogData.description && (
                          <p className="text-gray-600 text-sm">
                            {ogData.description}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm">
                          {ogData.title}
                        </h3>
                        {ogData.description && (
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                            {ogData.description}
                          </p>
                        )}
                        {ogData.site_name && (
                          <p className="text-gray-500 text-xs mt-2 uppercase tracking-wide">
                            {ogData.site_name}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    </div>
                  )}
                </div>
              </a>
            </div>
          </div>
        )}
        
        {/* Fallback: Show styled card when preview fails and we're not loading */}
        {previewUrl && !isLoadingOg && (!ogData || !ogData.title) && (
          <div className="w-full">
            {isPinterestUrl ? (
              <div className="border border-red-200 rounded-lg overflow-hidden bg-gradient-to-br from-red-50 to-pink-50 hover:shadow-lg transition-shadow">
                <a 
                  href={previewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.562-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.888-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.357-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.001 24c6.624 0 11.999-5.373 11.999-12C24 5.372 18.626.001 12.001.001z"/>
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full uppercase tracking-wide">PINTEREST</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-red-500 flex-shrink-0" />
                  </div>
                  <div className="mt-3">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      View Pin on Pinterest
                    </h3>
                    <p className="text-gray-600 text-sm">
                      Click to open and view this pin on Pinterest
                    </p>
                  </div>
                </a>
              </div>
            ) : (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm break-all block p-3 border border-[#e3cac0] rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {previewUrl}
              </a>
            )}
          </div>
        )}
        
        
        {instagramPostId && (
          <div className="w-full">
            <iframe
              src={`https://www.instagram.com/p/${instagramPostId}/embed/captioned/`}
              className="w-full h-[600px] rounded-md border-0"
              loading="lazy"
              allowFullScreen
              scrolling="no"
              frameBorder="0"
            />
          </div>
        )}
        {twitterPostId && (
          <div className="w-full">
            <a 
              href={urls.find(url => getTwitterPostId(url)) || '#'}
              target="_blank" 
              rel="noopener noreferrer"
              className="block rounded-lg border border-[#e3cac0] bg-gradient-to-br from-blue-50 to-sky-50 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-sky-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-900 text-sm">X Post</span>
                    <div className="w-1.5 h-1.5 bg-sky-400 rounded-full flex-shrink-0"></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              {/* Show post title if available from Open Graph, otherwise extract from URL */}
              {twitterOgData?.title ? (
                <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
                  {twitterOgData.title}
                </h3>
              ) : (
                <h3 className="font-medium text-gray-900 text-sm mb-2">
                  Post by @{urls.find(url => getTwitterPostId(url))?.match(/\/(\w+)\/status/)?.[1] || 'User'}
                </h3>
              )}
              
              {/* Show description if available */}
              {twitterOgData?.description && (
                <p className="text-gray-700 text-sm mb-3 line-clamp-3">
                  {twitterOgData.description}
                </p>
              )}
              
              <p className="text-gray-600 text-sm">
                x.com
              </p>
            </a>
          </div>
        )}
        {redditPostInfo && (
          <div className="w-full">
            <a 
              href={urls.find(url => url.includes('reddit.com')) || '#'}
              target="_blank" 
              rel="noopener noreferrer"
              className="block rounded-lg border border-[#e3cac0] bg-gradient-to-br from-orange-50 to-red-50 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full uppercase tracking-wide">REDDIT</span>
                </div>
                <ExternalLink className="w-4 h-4 text-orange-500 flex-shrink-0" />
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-gray-900 text-lg mb-1">
                  r/{redditPostInfo.subreddit}
                </h3>
                <p className="text-gray-600 text-sm">
                  View full discussion and comments on Reddit
                </p>
              </div>
            </a>
          </div>
        )}
        
        {/* Message text - Show after embeds, with hashtags and URLs removed */}
        {contentWithoutHashtags.length > 0 && (
          <p className="text-foreground break-words">
            {formattedContent}
          </p>
        )}
        
        {facebookPostId && (
          <div className="w-full">
            <iframe
              src={`https://www.facebook.com/plugins/post.php?href=https://www.facebook.com/permalink.php?story_fbid=${facebookPostId}&width=500&show_text=true&height=500`}
              className="w-full h-[500px] rounded-md border border-[#e3cac0]"
              loading="lazy"
              frameBorder="0"
              scrolling="no"
            />
          </div>
        )}
        {youtubeVideoId && (
          <div className="w-full">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              className="w-full h-[315px] rounded-md border-0"
              loading="lazy"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {tiktokVideoId && (
          <div className="w-full">
            {/* For numeric video IDs, use iframe embed */}
            {/^\d+$/.test(tiktokVideoId) ? (
              <iframe
                src={`https://www.tiktok.com/embed/v2/${tiktokVideoId}`}
                className="w-full h-[500px] rounded-md border-0"
                loading="lazy"
                frameBorder="0"
                allow="encrypted-media"
                allowFullScreen
              />
            ) : (
              /* For short URLs (vm.tiktok.com, tiktok.com/t/), show a styled link */
              <div className="w-full rounded-md border bg-gradient-to-br from-black to-gray-800 p-6">
                <div className="flex items-center justify-center">
                  <a 
                    href={urls.find(url => url.includes('tiktok.com')) || '#'}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white hover:text-gray-200 transition-colors flex items-center gap-3 text-lg font-medium hover:underline"
                  >
                    <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    <div className="text-left">
                      <div className="font-semibold">View on TikTok</div>
                      <div className="text-sm font-normal text-gray-300 mt-1">Click to open in new tab</div>
                    </div>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
        {imdbInfo && movieData && (
          <div className="w-full">
            <a 
              href={urls.find(url => url.includes('imdb.com')) || '#'}
              target="_blank" 
              rel="noopener noreferrer"
              className="block rounded-lg bg-white p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col">
                {movieData.posterUrl && (
                  <div className="w-full mb-4">
                    <img 
                      src={movieData.posterUrl}
                      alt={movieData.title || "Movie Poster"}
                      className="w-full h-auto object-cover rounded-lg shadow-lg"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">
                      {movieData.title}
                      {movieData.year && <span className="text-gray-600 font-normal"> ({movieData.year})</span>}
                    </h3>
                    {movieData.rating && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-bold text-gray-800">{movieData.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  {movieData.genres && movieData.genres.length > 0 && (
                    <p className="text-gray-600 text-sm">
                      {movieData.genres.join(', ')}
                    </p>
                  )}
                  
                  <p className="text-gray-600 text-sm">
                    imdb.com
                  </p>
                </div>
              </div>
            </a>
          </div>
        )}
        
        
        {/* Loading state for Open Graph */}
        {isLoadingOg && previewUrl && (
          <div className="w-full">
            <div className="border border-[#e3cac0] rounded-lg bg-white p-4">
              <div className="animate-pulse">
                <div className="w-full h-48 bg-gray-200 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )}
        
        {message.mediaUrl && !instagramPostId && !twitterPostId && !redditPostInfo && !facebookPostId && !youtubeVideoId && !tiktokVideoId && !imdbInfo && !ogData && (
          <div className="w-full max-w-lg mx-auto">
            {message.mediaType?.startsWith("image/") ? (
              <img
                src={message.mediaUrl}
                alt="Message attachment"
                className="rounded-md max-h-96 w-auto mx-auto object-contain"
                loading="lazy"
              />
            ) : message.mediaType?.startsWith("video/") ? (
              <video
                src={message.mediaUrl}
                className="rounded-md max-h-96 w-auto mx-auto"
                controls
                preload="metadata"
              />
            ) : (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View Attachment
              </a>
            )}
          </div>
        )}
        
        {/* Show hashtags at bottom */}
        <div className="flex items-center justify-between pt-3 border-t border-[#e3cac0] mt-3">
          {formattedHashtags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formattedHashtags.map((hashtag, i) => (
                <span key={i} className="inline-flex">
                  {hashtag}
                  {i < formattedHashtags.length - 1 && <span className="ml-1">&nbsp;</span>}
                </span>
              ))}
            </div>
          ) : (
            <div></div>
          )}
          <div className="text-sm text-muted-foreground">
            {format(new Date(message.timestamp), "MM/dd/yy")}
          </div>
        </div>
        
        {/* Show sender info for shared board messages at bottom */}
        {(message.senderFirstName || message.senderLastName || message.senderId) && (
          <div className="flex items-center justify-between pt-2 border-t border-[#e3cac0]">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={message.senderAvatarUrl || undefined} />
                <AvatarFallback className="bg-[#ed2024] text-white text-xs">
                  {message.senderFirstName && message.senderLastName
                    ? `${message.senderFirstName[0]}${message.senderLastName[0]}`.toUpperCase()
                    : message.senderDisplayName?.[0]?.toUpperCase() || 
                      getSenderInitials(message.senderId)
                  }
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {message.senderFirstName && message.senderLastName
                  ? `${message.senderFirstName} ${message.senderLastName}`
                  : message.senderDisplayName || 
                    (message.senderId ? 
                      formatSenderDisplay(message.senderId) : 
                      'Unknown')
                }
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                aria-label="Edit message"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete message"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    <DeleteMessageModal
      isOpen={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      messageId={message.id}
      messagePreview={message.content}
    />
    
    <EditMessageModal
      message={message}
      isOpen={showEditModal}
      onClose={() => setShowEditModal(false)}
    />
    </>
  );
}