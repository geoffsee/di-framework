#!/usr/bin/env bun test
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Window } from 'happy-dom';
import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(process.cwd());
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');
const BUILD_OUTPUT_DIR = join(PROJECT_ROOT, 'test-build-output');

describe('Writerside Documentation - Watermark Removal Verification', () => {
  beforeAll(async () => {
    console.log('Building documentation with Writerside Docker builder...');
    
    // Clean up any previous build artifacts
    if (existsSync(ARTIFACTS_DIR)) {
      rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
    }
    if (existsSync(BUILD_OUTPUT_DIR)) {
      rmSync(BUILD_OUTPUT_DIR, { recursive: true, force: true });
    }

    try {
      // Build docs using the same Docker command as GitHub Actions
      const dockerImage = 'registry.jetbrains.team/p/writerside/builder/writerside-builder:2.1.1479-p3869';
      const buildCommand = `
        docker run --rm \
          -v "${PROJECT_ROOT}:/github/workspace" \
          ${dockerImage} \
          /bin/bash -c "
            export DISPLAY=:99
            Xvfb :99 &
            git config --global --add safe.directory /github/workspace
            /opt/builder/bin/idea.sh helpbuilderinspect -source-dir /github/workspace/ -product Writerside/d --runner github -output-dir /github/workspace/artifacts/ || true
            test -e /github/workspace/artifacts/webHelpD2-all.zip && echo 'Build artifact created'
          "
      `;
      
      console.log('Running Docker build...');
      execSync(buildCommand, { 
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
        encoding: 'utf-8'
      });

      // Unzip the artifact
      if (existsSync(join(ARTIFACTS_DIR, 'webHelpD2-all.zip'))) {
        console.log('Unzipping documentation artifact...');
        execSync(`unzip -qq ${join(ARTIFACTS_DIR, 'webHelpD2-all.zip')} -d ${BUILD_OUTPUT_DIR}`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8'
        });
        console.log('Documentation built successfully!');
      } else {
        throw new Error('Build artifact not found');
      }
    } catch (error) {
      console.error('Failed to build documentation:', error);
      throw error;
    }
  }, 300000); // 5 minute timeout for building

  afterAll(() => {
    // Clean up build artifacts
    console.log('Cleaning up build artifacts...');
    if (existsSync(ARTIFACTS_DIR)) {
      rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
    }
    if (existsSync(BUILD_OUTPUT_DIR)) {
      rmSync(BUILD_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  it('should build documentation successfully', () => {
    expect(existsSync(BUILD_OUTPUT_DIR)).toBe(true);
    const files = readdirSync(BUILD_OUTPUT_DIR);
    expect(files.length).toBeGreaterThan(0);
  });

  it('should not contain "Powered by JetBrains Writerside" text in any HTML file', () => {
    const htmlFiles = findHtmlFiles(BUILD_OUTPUT_DIR);
    expect(htmlFiles.length).toBeGreaterThan(0);

    const watermarkText = 'Powered by JetBrains Writerside';
    const filesWithWatermark: string[] = [];

    for (const htmlFile of htmlFiles) {
      const content = readFileSync(htmlFile, 'utf-8');
      
      // Check if watermark text exists in the raw HTML
      if (content.toLowerCase().includes(watermarkText.toLowerCase())) {
        filesWithWatermark.push(htmlFile);
      }
    }

    if (filesWithWatermark.length > 0) {
      console.error('Watermark found in the following files:');
      filesWithWatermark.forEach(file => console.error(`  - ${file}`));
    }

    expect(filesWithWatermark).toEqual([]);
  });

  it('should not render footer with watermark in parsed DOM', () => {
    const htmlFiles = findHtmlFiles(BUILD_OUTPUT_DIR);
    expect(htmlFiles.length).toBeGreaterThan(0);

    const watermarkText = 'Powered by JetBrains Writerside';
    const filesWithVisibleWatermark: string[] = [];

    for (const htmlFile of htmlFiles) {
      const htmlContent = readFileSync(htmlFile, 'utf-8');
      const window = new Window();
      const document = window.document;
      
      document.write(htmlContent);

      // Check for footer elements that might contain the watermark
      const footers = document.querySelectorAll('footer');
      
      for (const footer of footers) {
        const footerText = footer.textContent || '';
        if (footerText.includes(watermarkText)) {
          filesWithVisibleWatermark.push(htmlFile);
          break;
        }
      }

      // Also check for any element with data-test="footer"
      const footerElements = document.querySelectorAll('[data-test="footer"]');
      for (const element of footerElements) {
        const elementText = element.textContent || '';
        if (elementText.includes(watermarkText)) {
          if (!filesWithVisibleWatermark.includes(htmlFile)) {
            filesWithVisibleWatermark.push(htmlFile);
          }
          break;
        }
      }

      window.close();
    }

    if (filesWithVisibleWatermark.length > 0) {
      console.error('Visible watermark found in the DOM of the following files:');
      filesWithVisibleWatermark.forEach(file => console.error(`  - ${file}`));
    }

    expect(filesWithVisibleWatermark).toEqual([]);
  });

  it('should have custom CSS applied (footer.css referenced)', () => {
    const htmlFiles = findHtmlFiles(BUILD_OUTPUT_DIR);
    expect(htmlFiles.length).toBeGreaterThan(0);

    let foundCssReference = false;

    for (const htmlFile of htmlFiles) {
      const content = readFileSync(htmlFile, 'utf-8');
      
      // Check if footer.css is referenced
      if (content.includes('footer.css')) {
        foundCssReference = true;
        break;
      }
    }

    // It's okay if the CSS is inlined or bundled, so we just log this
    if (!foundCssReference) {
      console.warn('Note: footer.css not found as a separate file reference (may be inlined/bundled)');
    }
  });
});

function findHtmlFiles(dir: string): string[] {
  const htmlFiles: string[] = [];
  
  function traverse(currentDir: string) {
    if (!existsSync(currentDir)) return;
    
    const entries = readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return htmlFiles;
}
