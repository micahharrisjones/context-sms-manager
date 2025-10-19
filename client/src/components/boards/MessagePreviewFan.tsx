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

  // Rotation angles for fan effect (left to right)
  const rotations = [-5, 0, 5];

  return (
    <div className="relative h-32 w-full flex items-center justify-center">
      {messages.map((message, index) => {
        const rotation = rotations[index] || 0;
        const zIndex = index;
        const translateX = index * 8; // Spread cards horizontally

        return (
          <div
            key={message.id}
            className="absolute"
            style={{
              transform: `rotate(${rotation}deg) translateX(${translateX}px)`,
              zIndex,
              transition: 'transform 0.2s ease-in-out'
            }}
          >
            <MessagePreviewCard message={message} />
          </div>
        );
      })}
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
      <div className="w-20 h-24 rounded-lg overflow-hidden shadow-md bg-gray-200 border-2 border-white">
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
      <div className="w-20 h-24 rounded-lg shadow-md bg-gradient-to-br from-[#b95827]/20 to-[#263d57]/20 border-2 border-white p-2 flex flex-col items-center justify-center">
        <svg 
          className="w-8 h-8 text-[#b95827] mb-1" 
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
        <p className="text-xs text-[#263d57] text-center">Link</p>
      </div>
    );
  }

  // Text-only card
  const truncatedText = message.content.slice(0, 50);
  
  return (
    <div className="w-20 h-24 rounded-lg shadow-md bg-[#fff2ea] border-2 border-white p-2 flex items-start overflow-hidden">
      <p className="text-xs text-[#263d57] line-clamp-4 overflow-hidden break-words">
        {truncatedText}
        {message.content.length > 50 && '...'}
      </p>
    </div>
  );
}
