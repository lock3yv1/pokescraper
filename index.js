import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

async function scrapeWithStealth(url) {
  const browser = await puppeteer.[span_5](start_span)launch({ headless: "new" }); // Use "new" for 2026 efficiency[span_5](end_span)
  const page = await browser.newPage();
  
  [span_6](start_span)// Set realistic viewport and headers[span_6](end_span)
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  [span_7](start_span)try {
    // Navigate with a "Warm-up" wait[span_7](end_span)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(Math.floor(Math.random() * 3000) + 2000); // Random 2-5s delay

    const content = await page.content();
    await browser.close();
    return content;
  } catch (e) {
    console.error(`Stealth failure on ${url}:`, e.message);
    await browser.close();
    return null;
  }
}
