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

((outer_text (prose_html))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "html"))

((outer_text (prose_rst))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "rst"))

((outer_text (prose_rtf))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "rtf"))

((outer_text (prose_javadoc))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "javadoc"))

((outer_text (prose_jsdoc))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "jsdoc"))

((outer_text (prose_doxygen))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "doxygen"))

((outer_text (prose_org))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "org"))

((outer_text (prose_asciidoc))
 @injection.content
 (#set! injection.include-children true)
 (#set! injection.combined true)
 (#set! injection.language "asciidoc"))
