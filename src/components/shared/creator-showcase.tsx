"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { ContentCreator } from "@/lib/data/content-creators";
import { socialLabel } from "@/lib/creator-socials";
import { SocialIcon } from "@/components/admin/social-icons";
import { Modal } from "@/components/ui";

function CreatorImage({ creator, iconSize = 22 }: { creator: ContentCreator; iconSize?: number }) {
  if (creator.profileImageUrl) {
    return (
      // Creator images are sanitized or re-hosted by the admin save action.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={creator.profileImageUrl} alt="" loading="lazy" decoding="async" />
    );
  }

  const fallbackPlatform = creator.socials[0]?.platform;
  return (
    <span className="creator-image-fallback" aria-hidden="true">
      <span>{creator.name.slice(0, 1).toUpperCase()}</span>
      {fallbackPlatform && (
        <i>
          <SocialIcon platform={fallbackPlatform} size={Math.max(13, Math.round(iconSize * 0.65))} />
        </i>
      )}
    </span>
  );
}

function CreatorRibbonItem({
  creator,
  duplicate = false,
  position,
  onOpen,
}: {
  creator: ContentCreator;
  duplicate?: boolean;
  position: number;
  onOpen: (creator: ContentCreator) => void;
}) {
  return (
    <button
      type="button"
      className="creator-ribbon-item"
      onClick={() => onOpen(creator)}
      aria-label={duplicate ? undefined : `Open ${creator.name}'s channels`}
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : 0}
      data-creator-position={position}
    >
      <span className="creator-ribbon-avatar"><CreatorImage creator={creator} iconSize={26} /></span>
      <span className="creator-ribbon-copy">
        <strong>{creator.name}</strong>
        <small>{creator.bio || "Watch this creator's latest Mazora content and streams."}</small>
        <span className="creator-ribbon-platforms" aria-hidden="true">
          {creator.socials.slice(0, 3).map((social) => (
            <span key={`${social.platform}-${social.url}`} title={socialLabel(social.platform)}>
              <SocialIcon platform={social.platform} size={15} />
            </span>
          ))}
          <em>{creator.socials.length === 1 ? socialLabel(creator.socials[0].platform) : `${creator.socials.length} channels`}</em>
        </span>
      </span>
    </button>
  );
}

function CreatorRibbonRow({
  row,
  rowIndex,
  onOpen,
}: {
  row: ContentCreator[];
  rowIndex: number;
  onOpen: (creator: ContentCreator) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const secondFrameRef = useRef<number | null>(null);
  const normalizationFrameRef = useRef<number | null>(null);
  const [manualSlide, setManualSlide] = useState<{ index: number; x: number; snap?: boolean } | null>(null);
  const animated = row.length > 1;
  const groupCount = 3;

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (secondFrameRef.current) cancelAnimationFrame(secondFrameRef.current);
    if (normalizationFrameRef.current) cancelAnimationFrame(normalizationFrameRef.current);
  }, []);

  const resumeAutomaticRotation = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (secondFrameRef.current) cancelAnimationFrame(secondFrameRef.current);
    if (normalizationFrameRef.current) cancelAnimationFrame(normalizationFrameRef.current);
    resumeTimerRef.current = null;
    loopTimerRef.current = null;
    frameRef.current = null;
    secondFrameRef.current = null;
    normalizationFrameRef.current = null;
    setManualSlide(null);
  };

  const move = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const cards = Array.from(viewport.querySelectorAll<HTMLElement>(".creator-ribbon-item"));
    const firstCard = cards[0];
    if (!firstCard) return;

    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    const currentIndex = manualSlide?.index ?? cards.reduce((closest, card, cardIndex) => {
        const distance = Math.abs(card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2 - viewportCenter);
        return distance < closest.distance
          ? { distance, index: cardIndex }
          : closest;
      }, { distance: Number.POSITIVE_INFINITY, index: 0 }).index;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const group = firstCard.parentElement;
    const gap = group ? Number.parseFloat(getComputedStyle(group).columnGap || getComputedStyle(group).gap || "0") : 0;
    const centeredStart = (viewportRect.width - cardWidth) / 2;
    const positionFor = (index: number) => centeredStart - index * (cardWidth + gap);
    const logicalIndex = ((currentIndex % row.length) + row.length) % row.length;
    const loopStartIndex = row.length + logicalIndex;
    const nextIndex = loopStartIndex + direction;

    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (secondFrameRef.current) cancelAnimationFrame(secondFrameRef.current);
    if (normalizationFrameRef.current) cancelAnimationFrame(normalizationFrameRef.current);

    const animateToNext = () => {
      setManualSlide({ index: nextIndex, x: positionFor(nextIndex) });

      if (nextIndex < row.length || nextIndex >= row.length * 2) {
        const normalizedIndex = nextIndex < row.length ? nextIndex + row.length : nextIndex - row.length;
        loopTimerRef.current = setTimeout(() => {
          setManualSlide({ index: normalizedIndex, x: positionFor(normalizedIndex), snap: true });
          normalizationFrameRef.current = requestAnimationFrame(() => {
            setManualSlide({ index: normalizedIndex, x: positionFor(normalizedIndex) });
          });
        }, 440);
      }
    };

    if (loopStartIndex !== currentIndex) {
      setManualSlide({ index: loopStartIndex, x: positionFor(loopStartIndex), snap: true });
      frameRef.current = requestAnimationFrame(() => {
        secondFrameRef.current = requestAnimationFrame(() => {
          animateToNext();
        });
      });
    } else {
      animateToNext();
    }

    if (window.matchMedia("(hover: none)").matches) {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(resumeAutomaticRotation, 3200);
    }
  };

  const trackStyle = animated
    ? ({
      animationDuration: `${Math.max(24, row.length * 8)}s`,
      "--creator-ribbon-groups": groupCount,
      ...(manualSlide ? { transform: `translate3d(${manualSlide.x}px, 0, 0)` } : {}),
    } as CSSProperties)
    : undefined;

  return (
    <div
      ref={viewportRef}
      className={`creator-ribbon-row${rowIndex % 2 === 1 ? " is-reverse" : ""}${animated ? "" : " is-static"}${manualSlide ? " is-manual-row" : ""}`}
      onMouseLeave={resumeAutomaticRotation}
    >
      <div className={`creator-ribbon-track${manualSlide ? " is-manual" : ""}${manualSlide?.snap ? " is-snapping" : ""}`} style={trackStyle}>
        <div className="creator-ribbon-group">
          {row.map((creator, index) => (
            <CreatorRibbonItem key={creator.id} creator={creator} position={index} onOpen={onOpen} />
          ))}
        </div>
        {animated && Array.from({ length: groupCount - 1 }, (_, groupIndex) => (
          <div className="creator-ribbon-group" aria-hidden="true" key={`duplicate-group-${groupIndex}`}>
            {row.map((creator, index) => (
              <CreatorRibbonItem
                key={`duplicate-${groupIndex}-${creator.id}`}
                creator={creator}
                duplicate
                position={index}
                onOpen={onOpen}
              />
            ))}
          </div>
        ))}
      </div>

      {animated && (
        <div className="creator-ribbon-controls" aria-label="Creator carousel controls">
          <button
            type="button"
            className="creator-ribbon-control is-previous"
            onClick={() => move(-1)}
            aria-label="Show previous creator"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="creator-ribbon-control is-next"
            onClick={() => move(1)}
            aria-label="Show next creator"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export function CreatorShowcase({ creators, compact = false }: { creators: ContentCreator[]; compact?: boolean }) {
  const [selected, setSelected] = useState<ContentCreator | null>(null);
  if (creators.length === 0) return null;

  const rows = !compact && creators.length >= 6
    ? [creators.filter((_, index) => index % 2 === 0), creators.filter((_, index) => index % 2 === 1)]
    : [creators];

  return (
    <>
      <div className={compact ? "creator-showcase is-compact" : "creator-showcase"}>
        {rows.map((row, rowIndex) => (
          <CreatorRibbonRow
            key={row.map((creator) => creator.id).join("-")}
            row={row}
            rowIndex={rowIndex}
            onOpen={setSelected}
          />
        ))}
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} label={selected ? `${selected.name} channels` : "Creator channels"} size="compact">
        {selected && (
          <div className="creator-channel-modal panel">
            <div className="creator-channel-modal-profile">
              <span className="creator-channel-modal-image"><CreatorImage creator={selected} iconSize={32} /></span>
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.bio || "Follow this creator on their active channels."}</p>
              </div>
            </div>
            <div className="creator-channel-links">
              {selected.socials.length > 0 ? selected.socials.map((social) => (
                <a key={`${social.platform}-${social.url}`} href={social.url} target="_blank" rel="noreferrer noopener">
                  <span className="creator-channel-link-icon"><SocialIcon platform={social.platform} size={20} /></span>
                  <span><strong>{socialLabel(social.platform)}</strong><small>Open channel</small></span>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              )) : (
                <p className="creator-channel-links-empty">This creator has not added any public channels yet.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
