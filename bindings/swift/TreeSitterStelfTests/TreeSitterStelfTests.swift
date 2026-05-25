import XCTest
import SwiftTreeSitter
import TreeSitterStelf

final class TreeSitterStelfTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_stelf())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Stelf grammar")
    }
}
