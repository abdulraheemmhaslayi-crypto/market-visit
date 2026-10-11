'use client';

import React from 'react';

export interface FreeAiAssistantProps {
  visits?: any[];
  reportRows?: any;
  isOpenDefault?: boolean;
  className?: string;
  stats?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
}

/**
 * AI Assistant removed per user request.
 */
export default function FreeAiAssistant(_props: FreeAiAssistantProps) {
  return null;
}
