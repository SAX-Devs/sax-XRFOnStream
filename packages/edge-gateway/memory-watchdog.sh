#!/bin/sh
# Userspace memory guard for the Edge Gateway.
#
# Raspberry Pi OS ships with the cgroup memory controller disabled, so the
# systemd MemoryMax=512M in the unit is NOT enforced there. Until
# `cgroup_enable=memory cgroup_memory=1` is added to /boot/firmware/cmdline.txt
# (requires a reboot — maintenance window), this timer-driven check enforces the
# same cap from userspace: if the gateway's RSS exceeds the limit, restart ONLY
# the gateway. The equipment is never touched.

LIMIT_KB=524288  # 512 MB

PID=$(systemctl show -p MainPID --value xrfonstream-edge-gateway)
if [ -z "$PID" ] || [ "$PID" = "0" ]; then
    exit 0  # gateway not running — nothing to guard
fi

RSS_KB=$(awk '/VmRSS/{print $2}' "/proc/$PID/status" 2>/dev/null)
if [ -z "$RSS_KB" ]; then
    exit 0
fi

if [ "$RSS_KB" -gt "$LIMIT_KB" ]; then
    echo "edge-gateway RSS ${RSS_KB}kB exceeds ${LIMIT_KB}kB - restarting gateway" \
        | systemd-cat -t egw-memwatch -p warning
    systemctl restart xrfonstream-edge-gateway
fi
