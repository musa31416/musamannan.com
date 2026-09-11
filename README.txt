Personal site, static build for GitHub Pages
============================================
Three pages: / (homepage), /resume/, /cv/. Plain HTML and CSS. No build step,
no dependencies, no framework. Light theme.

Every internal link is root-relative, so the same files work on any domain.


DEPLOY TO GITHUB PAGES
======================
No GitHub Education account is needed. Pages is free on a normal free
account. The one condition is that the repository must be PUBLIC.

1. Create a new PUBLIC repo. Any name works.

2. Upload the CONTENTS of this folder to the repo root, not the folder
   itself. The layout should be:

     index.html
     style.css
     resume/index.html
     cv/index.html
     resume.pdf
     favicon.svg
     404.html
     robots.txt
     sitemap.xml
     CNAME
     .nojekyll

   Drag and drop works: repo > Add file > Upload files. The web uploader
   preserves the resume/ and cv/ folders if you drag the folders in.

3. Settings > Pages > Source: "Deploy from a branch", branch main, folder /
   Save. First build takes a minute or two.

4. Settings > Pages > Custom domain: type your domain, Save.
   Then tick "Enforce HTTPS" once the certificate is issued. That can take
   up to an hour on a fresh domain. The tickbox stays greyed out until then,
   which is normal and not a fault.

5. DNS, at whichever registrar holds the domain. For the apex (no www):

     A    @    185.199.108.153
     A    @    185.199.109.153
     A    @    185.199.110.153
     A    @    185.199.111.153

   and for www:

     CNAME  www  <your-github-username>.github.io

   If your domain is at Cloudflare, set those records to DNS only (grey
   cloud), not proxied. Proxying in front of GitHub Pages breaks GitHub's
   certificate issuance and you will be stuck at step 4.

CNAME already contains musamannan.com. Edit it if you register something
else, or just set the domain in the Settings > Pages UI and let GitHub
rewrite the file for you.

.nojekyll is an empty file that stops GitHub running Jekyll over the site.
Leave it there. Without it, anything whose filename starts with an
underscore is silently ignored.


IF YOU REGISTER A DOMAIN OTHER THAN musamannan.com
==================================================
Search and replace "musamannan.com" in six files:
  index.html, resume/index.html, cv/index.html, sitemap.xml, robots.txt, CNAME
Those are meta tags, the sitemap and the domain binding. Nothing else
depends on it.


WHAT GITHUB PAGES CANNOT DO
===========================
There is no server configuration. No .htaccess, no redirect rules, no custom
headers. So there is no /cv.pdf shortcut and no cache or security headers.
The three pages and resume.pdf are unaffected.

Also: the repo is public, and so is its whole commit history. If you ever
commit a company-tailored resume and later delete it, that version stays
permanently reachable through the history. Deleting the file does not remove
it. Keep tailored variants out of the repo from the first commit.


AUTHORSHIP SECTION
-----------------
The last section of the homepage is a continuous marquee of book covers.
Covers live in img/books/ and are listed twice in index.html: the first set
carries the real alt text, the duplicate set is aria-hidden and exists only
so the loop is seamless. If you add or remove a cover you must change BOTH
copies, or the animation will jump. It pauses on hover and stops entirely
for anyone whose system is set to reduce motion.

Still to fix there:
- Only 16 covers came through, not 17. Add the missing one to img/books/,
  then add a <figure> for it in both halves of the shelf track.
- img/books/dystopia.jpg carries a "rokomari.com" retailer watermark.
  Replace it with a clean file from the publisher.
- img/books/cover-07.jpg has alt text reading "CHECK TITLE" because the
  title is cropped at the top of the image you sent.


PHOTOS
------
img/avatar.jpg      nav logo, circular, cropped from the flags photo
img/musa-lab.jpg    hero portrait, the microscope shot
img/musa-flags.jpg  Authorship section portrait

To swap any of them, replace the file at the same path and keep the aspect
ratio close, or update the width and height attributes in index.html so the
browser reserves the right space and the page does not jump while loading.


BEFORE YOU TELL ANYONE ABOUT THE SITE
=====================================
- resume.pdf is current, rebuilt from resume.tex (included in this bundle).
  If you edit the resume, edit resume.tex, run pdflatex twice, and copy the
  new resume.pdf here. Keep resume/index.html in step with it.
- Add Honors/Awards and Service sections to the CV. Both are missing and
  their absence is visible on an academic CV.
- The npj paper is listed with DOI 10.1038/s44334-026-00109-5. Confirm that
  is correct, and add the volume and article number once it is online.
- When the Advanced Materials paper is accepted, change "Under review" to
  the journal details in resume/index.html and cv/index.html.
- Decide on the public email. It is musa314@utdallas.edu in several places.
- There is deliberately no phone number on the site. Scrapers harvest them.
- LinkedIn, Google Scholar and ORCID are already wired in on all three
  pages and into the structured data on the homepage.

PUBLICATION COUNT
-----------------
Everything agrees at 6 journal papers and proceedings, 2 of them under
review. The homepage stat, the resume page and resume.pdf all show those 6.
The CV shows the same 6 plus the M.S. thesis under its own heading, which
is the normal academic convention and does not affect the headline count.


RESUME SOURCE
-------------
resume.tex is the LaTeX source for resume.pdf. It is set up for applicant
tracking systems: T1 font encoding and glyphtounicode so the PDF text
extracts as real characters, hyphenation disabled so no word breaks across
a line, standard section names, month-year dates, single column, no tables.
Build with:

    pdflatex resume.tex
    pdflatex resume.tex        (run twice)

Do not switch to XeLaTeX or LuaLaTeX without removing the \pdfgentounicode
line, which is a pdfTeX primitive. If mathptmx is missing on your machine,
swap it for \usepackage{times}, though mathptmx is the better choice.


UPDATING THE RESUME LATER
=========================
Overwrite resume.pdf, keeping the filename. The URL never changes, so a link
printed on a resume you sent in March still resolves in September. Edit
resume/index.html to match so the HTML and the PDF do not drift apart.


THEME
=====
Light. The palette lives in the :root block at the top of style.css and
every text/background pair in it clears WCAG AA contrast. To retune the
accent, change --accent and --accent-hi and nothing else.
