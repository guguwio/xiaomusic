from types import SimpleNamespace

from xiaomusic.config import Device
from xiaomusic.device_manager import DeviceManager


class DummyLog:
    def info(self, *_args, **_kwargs):
        pass

    def warning(self, *_args, **_kwargs):
        pass


def make_manager(group_play_mode="auto", group_play_master=""):
    devices = {
        "did_left": Device(
            did="did_left",
            device_id="device_left",
            hardware="sound2pro",
            name="Sound2 Pro 左",
        ),
        "did_right": Device(
            did="did_right",
            device_id="device_right",
            hardware="sound2pro",
            name="Sound2 Pro 右",
        ),
    }
    config = SimpleNamespace(
        group_list="did_left:客厅,did_right:客厅",
        group_play_mode=group_play_mode,
        group_play_master=group_play_master,
        devices=devices,
    )
    manager = DeviceManager(config, DummyLog(), None)
    manager.groups = {"客厅": ["device_left", "device_right"]}
    manager.group_devices = {"客厅": list(devices.values())}
    return manager


def test_auto_mode_plays_all_sound2_pro_stereo_devices():
    manager = make_manager()

    assert manager.get_group_play_device_id_list("客厅", "device_left") == [
        "device_left",
        "device_right",
    ]


def test_master_mode_still_uses_configured_master():
    manager = make_manager(
        group_play_mode="master",
        group_play_master="客厅:did_right",
    )

    assert manager.get_group_play_device_id_list("客厅", "device_left") == [
        "device_right",
    ]
