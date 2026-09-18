import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { trackGrowthEvent } from '@/lib/marketingAnalytics';
export function MarketingAnalytics(){
  const [location]=useLocation();
  useEffect(()=>{trackGrowthEvent('page_view',{route:location});},[location]);
  useEffect(()=>{const onClick=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-growth-event]'):null;const name=target?.dataset.growthEvent as Parameters<typeof trackGrowthEvent>[0]|undefined;if(name) trackGrowthEvent(name,{label:target?.textContent?.trim().slice(0,120)});};document.addEventListener('click',onClick,true);return()=>document.removeEventListener('click',onClick,true);},[]);
  return null;
}