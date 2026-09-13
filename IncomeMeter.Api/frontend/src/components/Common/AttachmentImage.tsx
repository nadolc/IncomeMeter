import React, { useEffect, useState } from 'react';
import { fetchAttachmentObjectUrl } from '../../utils/api';

interface AttachmentImageProps {
  attachmentId: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// Simple in-memory cache so the same thumbnail is not re-downloaded on every render.
const urlCache = new Map<string, string>();

/**
 * Renders a private attachment. `<img src>` cannot send the bearer token, so the file is
 * fetched with axios and shown through an object URL.
 */
const AttachmentImage: React.FC<AttachmentImageProps> = ({ attachmentId, alt = '', className = '', onClick }) => {
  const [url, setUrl] = useState<string | null>(urlCache.get(attachmentId) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (urlCache.has(attachmentId)) {
      setUrl(urlCache.get(attachmentId)!);
      return;
    }
    fetchAttachmentObjectUrl(attachmentId)
      .then(objectUrl => {
        if (cancelled) return;
        urlCache.set(attachmentId, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (!url) {
    return <div className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return <img src={url} alt={alt} className={className} onClick={onClick} />;
};

export default AttachmentImage;
