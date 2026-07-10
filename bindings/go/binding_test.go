package tree_sitter_visualforce_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_visualforce "github.com/damecek/tree-sitter-visualforce/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_visualforce.Language())
	if language == nil {
		t.Errorf("Error loading Visualforce grammar")
	}
}
