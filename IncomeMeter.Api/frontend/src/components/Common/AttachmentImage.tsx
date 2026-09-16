import React, { useEffect, useRef, useState } from 'react';
import { fetchAttachmentObjectUrl, fetchAttachmentThumbnailUrl } from '../../utils/api';

interface AttachmentImageProps {
  attachmentId: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  /** Load the full-size original instead of the small preview (use for the lightbox). */
  full?: boolean;
}

// Object URLs cached per (id, size) so re-renders and re-visits don't re-download.
const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const load = (attachmentId: string, full: boolean): Promise<string> => {
  const key = `${full ? 'full' : 'thumb'}:${attachmentId}`;
  const cached = urlCache.get(key);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(key);
  if (!p) {
    p = (full ? fetchAttachmentObjectUrl(attachmentId) : fetchAttachmentThumbnailUrl(attachmentId))
      .then(url => {
        urlCache.set(key, url);
        pending.delete(key);
        return url;
      })
      .catch(err => {
        pending.delete(key);
        throw err;
      });
    pending.set(key, p);
  }
  return p;
};

/**
 * Renders a private attachment. `<img src>` cannot send the bearer token, so the file is fetched with
 * axios and shown through an object URL. Lists get the ~10 KB thumbnail and only fetch it once the
 * element scrolls into view.
 */
const AttachmentImage: React.FC<AttachmentImageProps> = ({ attachmentId, alt = '', className = '', onClick, full = false }) => {
  const key = `${full ? 'full' : 'thumb'}:${attachmentId}`;
  const [url, setUrl] = useState<string | null>(urlCache.get(key) ?? null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(full || !!urlCache.get(key));
  const ref = useRef<HTMLDivElement>(null);

  // Lazy: wait until the placeholder is near the viewport.
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setFailed(false);
    load(attachmentId, full)
      .then(objectUrl => { if (!cancelled) setUrl(objectUrl); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attachmentId, full, visible]);

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
    return <div ref={ref} className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />;
};

export default AttachmentImage;
