from fde_api_academy.progress import Progress, dashboard, save_progress


def test_dashboard_empty_progress(tmp_path, monkeypatch):
    path = tmp_path / "progress.json"
    save_progress(Progress(), path=path)

    import fde_api_academy.progress as progress_module

    monkeypatch.setattr(progress_module, "PROGRESS_PATH", path)
    stats = dashboard(progress_module.load_progress(path))
    assert stats["completion_percent"] == 0.0
    assert stats["accuracy_percent"] == 0.0
    assert stats["total_lessons"] == 17
