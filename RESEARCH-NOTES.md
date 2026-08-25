# Design notes

## Direction

The attached museum-hours reference contributes three ideas: a centered identity,
one changing visual, and a compact list that controls that visual. The portfolio
does not copy the museum's title, imagery, typography, or opening-hours metaphor.
Its content and visual language are specific to Seung Won Lee's research and design
practice.

## Information hierarchy

1. **Identity:** a compact `Seung Won Lee` masthead
2. **Current profile:** two concise lines for role and research interests
3. **Fixed preview:** remains completely still while the work index scrolls underneath
4. **Work index:** chronological DOI-linked research with authorship tags
5. **Contact:** email, local PDF CV, and Google Scholar

Education is intentionally kept in the CV so the landing page stays focused on
current work.

The visual system uses a low-saturation deep-teal-to-mist gradient, a cool paper
surface, classic serif typography, and a subtle procedural grain texture. It avoids
the earlier beige paper and near-black outer background.

## Interaction rules

- The preview advances every four seconds from the first item downward.
- Research entries are ordered by publication year, newest first.
- Hovering or focusing an index row pauses the sequence and shows that item's media.
- Leaving the index resumes the sequence from the current item.
- Keyboard focus receives the same preview behavior as pointer hover.
- Visitors who prefer reduced motion receive manual-only previews.
- An entry can use a JPG, PNG, WebP, or GIF; a still `reducedImage` can accompany GIFs.
- The local Media Library can persist uploaded images and per-project assignments in
  the current browser without altering the published source files.

## Maintenance principle

Publication order, DOI URLs, labels, default media, alt text, and background tones all
live in `content.js`. Temporary media assignments can be tested through the in-page
Media Library; approved public assets should still be committed to `assets/` and
`content.js`.
