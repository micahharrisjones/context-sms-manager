interface MessagePreview {
  id: number;
  content: string;
  timestamp: Date;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

interface MessagePreviewFanProps {
  messages: MessagePreview[];
}

// Helper to extract URLs from message content
function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;
  const matches = content.match(urlRegex);
  return matches || [];
}

// Helper to check if URL is likely to have visual content
function hasVisualContent(url: string): boolean {
  const visualDomains = [
    'instagram.com',
    'pinterest.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'youtube.com',
    'youtu.be',
    'tiktok.com',
    'facebook.com',
    'imdb.com'
  ];
  
  try {
    const urlObj = new URL(url);
    return visualDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

export function MessagePreviewFan({ messages }: MessagePreviewFanProps) {
  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 flex-shrink-0">
      {messages.map((message, index) => (
        <MessagePreviewCard key={message.id} message={message} />
      ))}
    </div>
  );
}

interface MessagePreviewCardProps {
  message: MessagePreview;
}

function MessagePreviewCard({ message }: MessagePreviewCardProps) {
  // Check if message has a direct image attachment
  const hasDirectImage = message.mediaUrl && message.mediaType?.startsWith('image/');
  
  // Extract URLs from content
  const urls = extractUrls(message.content);
  const hasVisualUrl = urls.some(url => hasVisualContent(url));

  // Show image preview if available
  if (hasDirectImage) {
    return (
      <div className="w-16 h-16 rounded-md overflow-hidden shadow-sm bg-gray-200 border border-gray-200">
        <img 
          src={message.mediaUrl!} 
          alt="Preview" 
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Show visual content indicator for messages with social media links
  if (hasVisualUrl) {
    return (
      <div className="w-16 h-16 rounded-md shadow-sm bg-gradient-to-br from-[#b95827] to-[#263d57] border border-gray-200 p-2 flex flex-col items-center justify-center">
        <svg 
          className="w-6 h-6 text-white mb-0.5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
        <p className="text-xs text-white text-center font-medium">Link</p>
      </div>
    );
  }

  // Text-only card
  const truncatedText = message.content.slice(0, 40);
  
  return (
    <div className="w-16 h-16 rounded-md shadow-sm bg-[#fff2ea] border border-gray-200 p-1.5 flex items-start overflow-hidden">
      <p className="text-xs text-[#263d57] line-clamp-3 overflow-hidden break-words leading-tight">
        {truncatedText}
        {message.content.length > 40 && '...'}
      </p>
    </div>
  );
}
