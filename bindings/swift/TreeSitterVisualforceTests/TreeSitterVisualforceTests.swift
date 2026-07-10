import XCTest
import SwiftTreeSitter
import TreeSitterVisualforce

final class TreeSitterVisualforceTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_visualforce())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Visualforce grammar")
    }
}
