# Seung Won Lee — Research & Design portfolio

A dependency-free static portfolio prepared for GitHub Pages. The page automatically
cycles through the work index; hovering or focusing a title pauses the sequence and
shows that work's assigned media. Clicking a row locks that preview; clicking the
same row again releases it. Publication navigation is handled only by the separate
**DOI ↗** button at the right edge.

## The one file you normally edit

Open `content.js`. Each research or design entry contains:

- `id`: permanent Media Library key; keep it stable after assigning local media
- `label`: compact title in the visible index
- `descriptor`: one-line explanation below the compact title
- `contribution`: authorship tag such as `1st Author` or `Co-author`
- `tags`: optional venue/index tags such as `SCIE`, `TOP 2%`, `IF=11.500`, or `TOP-TIER`
- `title`: full title used for accessibility and the image caption tooltip
- `venue`, `year`: index and preview metadata
- `url`: DOI or project URL; omit it for a preview-only design project
- `image`: JPG, PNG, WebP, GIF, MP4, WebM, or MOV stored in `assets/`
- `reducedImage`: optional still image used instead of a GIF or video when visitors
  prefer reduced motion; it is also the video's `poster`, so it shows immediately
  while the clip buffers

**Prefer MP4 over GIF for anything animated.** The stage plays video natively and
only preloads video *metadata*, while a GIF is downloaded in full on page load.
Converting the previews here shrank them from 49.1 MB to 2.8 MB with better colour
(GIF is capped at 256 colours):

```bash
ffmpeg -i in.gif -movflags +faststart -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos" \
  -c:v libx264 -profile:v high -crf 23 -preset slow -an out.mp4

# grab a poster frame (frame 62 here; use the clip's last frame)
ffmpeg -i out.mp4 -vf "select='eq(n\,62)'" -frames:v 1 -q:v 2 out-still.jpg
```
- `alt`: useful description of the assigned image or GIF
- `fit`: `contain` for interfaces/diagrams or `cover` for photographs; contained
  media automatically gets a subtle blurred edge-fill behind it
- `tone`: background color visible behind contained media
- `gallery`: three expandable image, GIF, or video archive slots used by Design Works
- `galleryCaptions`: short captions for those three archive slots
- `galleryFit`: `cover` or `contain` for each archive slot

The list order in `content.js` is also the automatic preview order; research is
currently arranged by publication year, newest first. Change
`cycleDuration` at the top of that file to adjust the timing.

## Use the in-page Media Library and project editor

When the site is opened from a local file, `localhost`, or `127.0.0.1`, a
**Media Library** button appears at the bottom-right. It is intentionally
unavailable on the published site — there is no query string that reveals it, so
editing always happens locally and is published by committing `content.js`.

1. Select **Add media** and choose one or more JPG, PNG, WebP, GIF, AVIF, MP4,
   WebM, or MOV files.
2. In **Media links**, choose a main preview for each item. Every Design Work also
   has three separately assignable archive slots.
3. In **Projects & publication tags**, expand an item to edit its type, titles,
   venue, year, URL, authorship, SCIE/~SCIE, TOP rank, IF/H5, image fit, and tone.
4. Use **Add project** or **Delete** to maintain the list, then select
   **Save projects**. **Reset defaults** restores the data from `content.js`.
5. Select **Save media links** after changing preview or archive assignments.
6. Select **Export content.js** when the list is ready to publish, replace the
   repository's `content.js` with the download, and commit it. Local uploaded files
   still need to be copied into `assets/` and referenced by path before publishing.

Browser storage is local to one browser and origin, so it is meant for previewing and
trying assignments. To publish the same data for every visitor, transfer the approved
values to `content.js`, copy approved files into `assets/`, and commit those changes to
GitHub.

## Preview locally

From the directory that contains `portfolio-draft`, run:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173/portfolio-draft/>.

## Publish with GitHub Pages

1. Make a GitHub repository and copy the contents of `portfolio-draft` into its root.
2. Commit and push the files.
3. In **Settings → Pages**, choose **Deploy from a branch**, then select your default
   branch and `/ (root)`.
4. Add `seung-won-lee.com` under **Custom domain** after the GitHub Pages preview is
   working and update the domain's DNS records using GitHub's current instructions.

### Move `seung-won-lee.com` from Cargo without downtime

1. Keep the Cargo site connected while the GitHub Pages default URL is tested.
2. Verify the domain in GitHub with the TXT record shown under the GitHub account's
   Pages settings.
3. Add `seung-won-lee.com` in the repository's **Settings → Pages → Custom domain**.
4. In Cargo's **Account Settings → Domain Names → … → Edit DNS**, replace only the
   existing website records. Keep any email-related MX and TXT records.
5. For the apex domain, add GitHub's four current A records. Point `www` by CNAME to
   `<github-username>.github.io` (not to a repository path).
6. After DNS resolves to GitHub, enable **Enforce HTTPS** in the repository's Pages
   settings. DNS and certificate changes can take a day or two to settle.

Always re-check the values against GitHub's current custom-domain documentation before
the final cutover: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>.

The included `.nojekyll` file keeps deployment simple. The site has no build step,
package manager, analytics, account, API key, or server-side dependency. The optional
Media Library uses only the browser's local IndexedDB storage.

## When you change styles.css or script.js

`index.html` loads the stylesheet and scripts with a `?v=` version tag:

```html
<link rel="stylesheet" href="styles.css?v=2" />
<script src="script.js?v=2" defer></script>
```

Bump every `?v=` number together (2 → 3 → 4 …) whenever `styles.css`, `script.js`,
`content.js`, or `media-library.js` changes. Without it a returning visitor can
load the new `index.html` alongside a cached older stylesheet or script, which
leaves the work index blank. The number itself is arbitrary; only the change
matters.

## Before the final launch

- Replace any placeholder media by updating the relevant `image` value in `content.js`.
- Confirm the postdoctoral title and all publication metadata one final time.
- Create an Open Graph preview image and add `og:image` to `index.html` if social-card
  previews are important.
