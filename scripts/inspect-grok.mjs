#!/usr/bin/env node
/**
 * Playwright script to inspect Grok Imagine favorites page structure.
 * Run with: node scripts/inspect-grok.mjs
 */

import { chromium } from 'playwright';

const GROK_FAVORITES_URL = 'https://grok.com/imagine/favorites';

async function inspectGrokPage() {
  console.log('Launching browser...');
  console.log('Please log in when the browser opens. Script will auto-detect when favorites are visible.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // Navigate to favorites page
  await page.goto(GROK_FAVORITES_URL, { waitUntil: 'domcontentloaded' });

  console.log('Waiting for favorites grid to appear (up to 2 minutes for login)...\n');

  // Wait for either images or a login form, then wait for images
  try {
    await page.waitForSelector('img[alt*="Generated image"], img[src*="imagine"]', { timeout: 120000 });
    console.log('Favorites grid detected!\n');
    await page.waitForTimeout(2000); // Let more load
  } catch (e) {
    console.log('Timeout waiting for favorites. Continuing anyway...\n');
  }

  console.log('=== INSPECTING GRID VIEW ===\n');

  // Inspect grid images
  const gridImages = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('img').forEach((img, i) => {
      if (img.src && (img.src.includes('imagine') || img.src.includes('grok') || img.src.includes('x.ai') || img.alt?.includes('Generated'))) {
        results.push({
          index: i,
          src: img.src,
          currentSrc: img.currentSrc,
          alt: img.alt?.slice(0, 50),
          naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
          displaySize: `${img.width}x${img.height}`,
        });
      }
    });
    return results;
  });

  console.log('Grid Images Found:', gridImages.length);
  gridImages.slice(0, 5).forEach(img => {
    console.log(`  [${img.index}] ${img.naturalSize} -> ${img.displaySize}`);
    console.log(`       src: ${img.src.slice(0, 120)}...`);
    console.log(`       alt: ${img.alt}`);
  });

  // Inspect videos
  const gridVideos = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('video').forEach((video, i) => {
      const sources = Array.from(video.querySelectorAll('source')).map(s => s.src);
      results.push({
        index: i,
        src: video.src,
        currentSrc: video.currentSrc,
        poster: video.poster,
        sources,
      });
    });
    return results;
  });

  console.log('\nGrid Videos Found:', gridVideos.length);
  gridVideos.slice(0, 3).forEach(v => {
    console.log(`  [${v.index}] src: ${v.src || '(none)'}`);
    console.log(`       currentSrc: ${v.currentSrc || '(none)'}`);
    console.log(`       poster: ${v.poster || '(none)'}`);
    if (v.sources.length) console.log(`       sources: ${v.sources.join(', ')}`);
  });

  // Check for lazy-loaded video attributes
  const lazyVideos = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[data-src], [data-video-src], [data-video]').forEach(el => {
      results.push({
        tag: el.tagName,
        dataSrc: el.getAttribute('data-src'),
        dataVideoSrc: el.getAttribute('data-video-src'),
        dataVideo: el.getAttribute('data-video'),
      });
    });
    return results;
  });

  if (lazyVideos.length) {
    console.log('\nLazy-loaded video attributes:', lazyVideos);
  }

  console.log('\n=== CLICKING FIRST CARD TO OPEN MODAL ===\n');

  // Try to click on the first favorite card
  const cardSelector = 'img[alt*="Generated image"]';
  const firstCard = await page.$(cardSelector);

  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(1500);

    // Inspect modal content
    const modalImages = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('img').forEach((img, i) => {
        if (img.src && img.naturalWidth > 500) {
          results.push({
            index: i,
            src: img.src,
            naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
          });
        }
      });
      return results;
    });

    console.log('Modal/Overlay Images (>500px wide):', modalImages.length);
    modalImages.forEach(img => {
      console.log(`  [${img.index}] ${img.naturalSize}`);
      console.log(`       ${img.src}`);
    });

    // Check for download buttons/links
    const downloadElements = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[download], a[href*="download"], button').forEach(el => {
        const label = el.getAttribute('aria-label') || el.textContent?.trim();
        if (label?.toLowerCase().includes('download') || el.hasAttribute('download')) {
          results.push({
            tag: el.tagName,
            href: el.href || null,
            download: el.getAttribute('download'),
            label: label?.slice(0, 50),
          });
        }
      });
      return results;
    });

    console.log('\nDownload buttons/links:', downloadElements);

    // Check network requests for original image patterns
    console.log('\n=== URL PATTERN ANALYSIS ===\n');

    const urlAnalysis = await page.evaluate(() => {
      const urls = [];
      document.querySelectorAll('img').forEach(img => {
        if (img.src) urls.push(img.src);
      });

      // Group by domain
      const byDomain = {};
      urls.forEach(url => {
        try {
          const domain = new URL(url).hostname;
          if (!byDomain[domain]) byDomain[domain] = [];
          byDomain[domain].push(url);
        } catch {}
      });

      return byDomain;
    });

    Object.entries(urlAnalysis).forEach(([domain, urls]) => {
      console.log(`${domain}: ${urls.length} images`);
      console.log(`  Example: ${urls[0]?.slice(0, 100)}...`);
    });

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  console.log('\n=== SCROLL TEST ===\n');

  // Count items and scroll
  const initialCount = await page.evaluate(() => {
    return document.querySelectorAll('img[alt*="Generated image"]').length;
  });
  console.log('Initial visible items:', initialCount);

  // Scroll down a few times
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const scrollable = Array.from(document.querySelectorAll('div')).find(el => {
        const style = getComputedStyle(el);
        return (style.overflowY === 'scroll' || style.overflow === 'scroll') &&
               el.scrollHeight > el.clientHeight + 100;
      });
      if (scrollable) {
        scrollable.scrollTop += 800;
      }
    });
    await page.waitForTimeout(600);
  }

  const afterScrollCount = await page.evaluate(() => {
    return document.querySelectorAll('img[alt*="Generated image"]').length;
  });
  console.log('After 5 scrolls:', afterScrollCount, '(virtual scrolling means count may stay similar)');

  console.log('\n=== DONE ===');
  console.log('Browser will close in 5 seconds...');

  await page.waitForTimeout(5000);
  await browser.close();
}

inspectGrokPage().catch(console.error);
