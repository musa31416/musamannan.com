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


BEFORE YOU TELL ANYONE ABOUT THE SITE
=====================================
- The homepage stat says 7 journal papers and proceedings, but the
  publication lists on /resume/ and /cv/ still show 5 entries. Add the
  missing papers to both lists, or a reader who clicks through will notice
  the mismatch. See "Publications" in resume/index.html and cv/index.html.
- Add Honors/Awards and Service sections to the CV. Both are missing and
  their absence is visible on an academic CV.
- Decide on the public email. It is musa314@utdallas.edu in several places.
- There is deliberately no phone number on the site. Scrapers harvest them.
- LinkedIn, Google Scholar and ORCID are already wired in on all three
  pages and into the structured data on the homepage.


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
