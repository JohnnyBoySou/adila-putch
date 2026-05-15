package git

import (
	"os"
	"path/filepath"
	"testing"

	gogit "github.com/go-git/go-git/v5"
)

func TestEngineSmoke(t *testing.T) {
	dir := t.TempDir()
	if _, err := gogit.PlainInit(dir, false); err != nil {
		t.Fatal(err)
	}

	s := NewService()

	if _, err := s.OpenRepo(dir); err != nil {
		t.Fatalf("OpenRepo: %v", err)
	}

	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	st, err := s.Status(dir)
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if len(st.Untracked) != 1 || st.Untracked[0].Path != "a.txt" {
		t.Fatalf("esperava a.txt untracked, veio %+v", st)
	}

	if err := s.StageFile(dir, "a.txt"); err != nil {
		t.Fatalf("StageFile: %v", err)
	}
	st, _ = s.Status(dir)
	if len(st.Staged) != 1 || st.Staged[0].Status != "added" {
		t.Fatalf("esperava a.txt staged/added, veio %+v", st.Staged)
	}

	hash, err := s.Commit(dir, "primeiro commit", "Tester", "tester@putch.dev")
	if err != nil {
		t.Fatalf("Commit: %v", err)
	}
	if len(hash) != 40 {
		t.Fatalf("hash inesperado: %q", hash)
	}

	log, err := s.Log(dir, 10)
	if err != nil || len(log) != 1 || log[0].Subject != "primeiro commit" {
		t.Fatalf("Log divergiu: %+v err=%v", log, err)
	}

	branches, err := s.ListBranches(dir)
	if err != nil || len(branches) != 1 || !branches[0].IsCurrent {
		t.Fatalf("ListBranches divergiu: %+v err=%v", branches, err)
	}

	// FileDiff de arquivo novo modificado após o commit
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello world\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	d, err := s.FileDiff(dir, "a.txt", false)
	if err != nil {
		t.Fatalf("FileDiff: %v", err)
	}
	if d.Status != "modified" || d.OldText != "hello\n" || d.NewText != "hello world\n" {
		t.Fatalf("FileDiff divergiu: %+v", d)
	}
}
