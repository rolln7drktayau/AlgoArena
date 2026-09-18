"""Deterministic non-preemptive list scheduling, SI time/energy units.

Compute demand: MI; per-device rate: MIPS; data: MB; bandwidth: Mbps;
power: W; time: s; energy: J; processing cost: currency / MI.
Each tier has a serialized input link. Cross-tier parent transfers share it.
This is an explicit simplified network model, not a packet simulator.
"""
from __future__ import annotations

import heapq
from typing import Any

import numpy as np

from ..core.models import ScenarioTask


def task_order(tasks: list[ScenarioTask]) -> list[int]:
    indices = {task.id: i for i, task in enumerate(tasks)}
    if len(indices) != len(tasks):
        raise ValueError("Task IDs must be unique.")
    children: list[list[int]] = [[] for _ in tasks]
    counts = []
    for i, task in enumerate(tasks):
        parents = set(task.parents)
        counts.append(len(parents))
        for parent in parents:
            if parent not in indices:
                raise ValueError(f"Missing parent {parent} for task {task.id}.")
            children[indices[parent]].append(i)
    ready = [i for i, count in enumerate(counts) if count == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        i = heapq.heappop(ready)
        order.append(i)
        for child in children[i]:
            counts[child] -= 1
            if counts[child] == 0:
                heapq.heappush(ready, child)
    if len(order) != len(tasks):
        raise ValueError("Workflow contains a cycle.")
    return order


def schedule(tiers: list[Any], tasks: list[ScenarioTask], candidate: np.ndarray,
             order: list[int]) -> tuple[dict[str, float], list[dict[str, Any]]]:
    if len(candidate) != len(tasks) or not np.isfinite(candidate).all():
        raise ValueError("Placement must contain one finite value per task.")
    assignments = np.clip(np.rint(candidate).astype(int), 0, len(tiers) - 1)
    machines = [[(0.0, i) for i in range(tier.devices)] for tier in tiers]
    links = [0.0] * len(tiers)
    busy = [0.0] * len(tiers)
    completed: dict[str, dict[str, Any]] = {}
    trace = []
    wait = latency = cost = tardiness = 0.0
    for index in order:
        task = tasks[index]
        tier_index = int(assignments[index])
        tier = tiers[tier_index]
        parents = [completed[parent] for parent in sorted(set(task.parents))]
        ready_at = max((parent["finish"] for parent in parents), default=0.0)
        transfer_start = ready_at
        transfer_time = 0.0
        if not parents:
            transfer_time = 8.0 * task.data_size / tier.uplink_bandwidth
        else:
            for parent in parents:
                if parent["tier_index"] != tier_index:
                    source = tiers[parent["tier_index"]]
                    bandwidth = min(source.downlink_bandwidth, tier.uplink_bandwidth)
                    transfer_time += 8.0 * (task.data_size / len(parents)) / bandwidth
        if transfer_time:
            transfer_start = max(ready_at, links[tier_index])
            links[tier_index] = transfer_start + transfer_time
        available, device = heapq.heappop(machines[tier_index])
        start = max(available, transfer_start + transfer_time)
        duration = task.compute_demand / tier.processing_rate
        finish = start + duration
        heapq.heappush(machines[tier_index], (finish, device))
        busy[tier_index] += duration
        wait += start - ready_at
        latency += finish
        cost += task.compute_demand * tier.processing_cost
        tardiness += max(0.0, finish - task.deadline) if task.deadline is not None else 0.0
        row = {"task_id": task.id, "tier": tier.name, "tier_index": tier_index,
               "device": device, "ready": ready_at, "transfer_start": transfer_start,
               "transfer_end": transfer_start + transfer_time, "start": start,
               "finish": finish, "parents": task.parents}
        trace.append(row)
        completed[task.id] = row
    makespan = max((row["finish"] for row in trace), default=0.0)
    energy = sum(tier.idle_power * max(0.0, tier.devices * makespan - busy[i])
                 + tier.working_power * busy[i] for i, tier in enumerate(tiers))
    return {"latency": latency, "cost": cost, "energy": energy, "makespan": makespan,
            "execution_speed": len(tasks) / max(1e-9, makespan),
            "avg_wait": wait / max(1, len(tasks)), "tardiness": tardiness}, trace
