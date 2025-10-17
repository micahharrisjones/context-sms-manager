import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { X, Edit, ExternalLink, User, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
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
  
  // Handle Reddit share URLs like /r/subreddit/s/shareId
  const shareMatch = url.match(/reddit\.com\/r\/(\w+)\/s\/([^/?]+)/);
  if (shareMatch) return { subreddit: shareMatch[1], postId: shareMatch[2] };
  
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
  // More robust URL regex that handles special characters, paths, and query strings
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;
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

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
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

  // Use hashtags from database instead of re-extracting from content
  // Format database tags back to hashtag display format (add # prefix)
  const hashtags = (message.tags ?? []).map(tag => `#${tag}`);
  
  // Extract content without hashtags for display - PRESERVE LINE BREAKS
  // Split by words but keep track of whitespace
  const contentWithoutHashtags = message.content
    .split(/(\s+)/) // Split on whitespace but keep the whitespace in the array
    .filter(part => {
      // Remove hashtags but keep everything else including whitespace
      const trimmed = part.trim();
      return !(trimmed.startsWith("#") && /^#[\w-]+$/.test(trimmed));
    })
    .join(''); // Join back together preserving all whitespace
  
  const instagramPostId = message.content ? getInstagramPostId(message.content) : null;
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
      getFacebookPostId(url) ||
      getYouTubeVideoId(url) ||
      getTikTokVideoId(url) ||
      getIMDbInfo(url)
    );
    return shouldFetchOpenGraph(url, hasUrlSpecificEmbed);
  }) || null;

  // Check if a URL has a rich preview (social media embed, IMDB, Open Graph)
  // IMPORTANT: Only hide URL if preview has actually loaded successfully
  const hasRichPreview = (url: string): boolean => {
    // Always show social media embeds (Instagram, Facebook, YouTube, TikTok)
    if (getInstagramPostId(url) || getFacebookPostId(url) || getYouTubeVideoId(url) || getTikTokVideoId(url)) {
      return true;
    }
    
    // For IMDB, only hide if movie data has loaded
    if (getIMDbInfo(url) && movieData) {
      return true;
    }
    
    // For Open Graph, only hide if OG data has loaded successfully
    if (previewUrl && url === previewUrl && ogData && ogData.title) {
      return true;
    }
    
    return false;
  };

  // Format the content: make URLs clickable and hide URLs with rich previews
  const formattedContent = contentWithoutHashtags.split(/(\s+)/).map((part, i) => {
    const trimmed = part.trim();
    
    // Check if the part is a URL
    if (trimmed) {
      try {
        new URL(trimmed);
        
        // Hide URLs that have rich previews
        if (hasRichPreview(trimmed)) {
          return null;
        }
        
        return (
          <a
            key={i}
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {trimmed}
          </a>
        );
      } catch {
        // Not a URL, return the text/whitespace as-is
        return part;
      }
    }
    
    // Return whitespace as-is
    return part;
  }).filter(part => part !== null && part !== undefined); // Remove null/undefined entries (hidden URLs)
  
  // Check if there's actual displayable content (not just whitespace or empty React arrays)
  const hasDisplayableContent = formattedContent.length > 0 && formattedContent.some(part => {
    if (typeof part === 'string') {
      return part.trim().length > 0;
    }
    // For React elements, they should be truthy and not null/undefined
    return part != null;
  });
  
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

  return (
    <>
      <Card className="w-full h-fit relative group">
        {/* Delete button - top right corner */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteModal(true)}
          className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 z-10"
          aria-label="Delete message"
          data-pendo="content-delete-btn"
          data-message-id={message.id}
        >
          <X className="h-3 w-3" />
        </Button>
        
      <CardContent className="space-y-4 pt-6">
        {/* Open Graph Preview - Show first */}
        {ogData && ogData.title && (
          <div className="w-full">
            <div className="shadow-md rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow">
              <a 
                href={previewUrl || ogData.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
                data-pendo="content-external-link-btn"
              >
                {ogData.image && (
                  <div className="aspect-video w-full bg-[#263d57]/10 overflow-hidden">
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
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#263d57] line-clamp-2 text-sm">
                        {decodeHtmlEntities(ogData.title)}
                      </h3>
                      {ogData.description && (
                        <p className="text-[#263d57]/70 text-sm mt-1 line-clamp-2">
                          {decodeHtmlEntities(ogData.description)}
                        </p>
                      )}
                      {ogData.site_name && (
                        <p className="text-[#263d57]/70 text-xs mt-2 uppercase tracking-wide">
                          {decodeHtmlEntities(ogData.site_name)}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-[#263d57]/50 flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        )}
        
        {/* Fallback: Show styled card when preview fails and we're not loading */}
        {previewUrl && !isLoadingOg && (!ogData || !ogData.title) && (
          <div className="w-full">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm break-all block p-3 shadow-md rounded-lg bg-[#263d57]/5 hover:bg-[#263d57]/10 transition-colors"
              data-pendo="content-external-link-btn"
            >
              {previewUrl}
            </a>
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
        
        {/* Message text - Show after embeds, with hashtags and URLs removed */}
        {hasDisplayableContent && (
          <>
            {/* Check if this is a plain text message (no rich embeds) */}
            {!instagramPostId && !facebookPostId && !youtubeVideoId && !tiktokVideoId && !imdbInfo && !ogData && !message.mediaUrl ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#e3cac0] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground break-words leading-relaxed whitespace-pre-wrap">
                    {formattedContent}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-foreground break-words whitespace-pre-wrap">
                {formattedContent}
              </p>
            )}
          </>
        )}
        
        {facebookPostId && (
          <div className="w-full">
            <iframe
              src={`https://www.facebook.com/plugins/post.php?href=https://www.facebook.com/permalink.php?story_fbid=${facebookPostId}&width=500&show_text=true&height=500`}
              className="w-full h-[500px] rounded-md shadow-md"
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
              <div className="w-full rounded-md border bg-gradient-to-br from-[#263d57] to-[#263d57] p-6">
                <div className="flex items-center justify-center">
                  <a 
                    href={urls.find(url => url.includes('tiktok.com')) || '#'}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white hover:text-[#263d57]/70 transition-colors flex items-center gap-3 text-lg font-medium hover:underline"
                  >
                    <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    <div className="text-left">
                      <div className="font-semibold">View on TikTok</div>
                      <div className="text-sm font-normal text-[#263d57]/60 mt-1">Click to open in new tab</div>
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
                    <h3 className="font-bold text-[#263d57] text-lg leading-tight">
                      {movieData.title}
                      {movieData.year && <span className="text-[#263d57]/70 font-normal"> ({movieData.year})</span>}
                    </h3>
                    {movieData.rating && (
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-bold text-[#263d57]">{movieData.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  {movieData.genres && movieData.genres.length > 0 && (
                    <p className="text-[#263d57]/70 text-sm">
                      {movieData.genres.join(', ')}
                    </p>
                  )}
                  
                  <p className="text-[#263d57]/70 text-sm">
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
                <div className="w-full h-48 bg-[#263d57]/10 rounded mb-3"></div>
                <div className="h-4 bg-[#263d57]/10 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-[#263d57]/10 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )}
        
        {message.mediaUrl && !instagramPostId && !facebookPostId && !youtubeVideoId && !tiktokVideoId && !imdbInfo && !ogData && (
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
              aria-label="Edit message"
              data-pendo="content-edit-btn"
              data-message-id={message.id}
            >
              <Edit className="h-3 w-3" />
            </Button>
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
          </div>
          <div className="text-sm text-muted-foreground">
            {format(new Date(message.timestamp), "MM/dd/yy")}
          </div>
        </div>
        
        {/* Show sender info for shared board messages only */}
        {(message.senderFirstName || message.senderLastName || message.senderDisplayName) && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#e3cac0]">
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