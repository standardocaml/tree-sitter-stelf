((outer_text (prose_markdown))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "markdown"))

((outer_text (prose_latex))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "latex"))

((outer_text (prose_typst))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "typst"))
