from __future__ import annotations


def list_problem_domains() -> list[dict[str, object]]:
    return [
        {
            "id": "multi_objective",
            "label": "Multi-objective optimization",
            "status": "stable",
            "examples": ["ZDT", "DTLZ", "WFG", "Edge/Fog/Cloud scheduling"],
            "visualizations": ["pareto_front", "convergence", "diversity_heatmap", "radar"],
        },
        {
            "id": "mono_objective",
            "label": "Single-objective optimization",
            "status": "planned",
            "examples": ["sphere", "rastrigin", "rosenbrock"],
            "visualizations": ["fitness_curve", "landscape_2d", "landscape_3d"],
        },
        {
            "id": "combinatorial",
            "label": "Combinatorial optimization",
            "status": "planned",
            "examples": ["TSP", "bin packing"],
            "visualizations": ["route_view", "packing_view", "genealogy_tree"],
        },
        {
            "id": "bayesian",
            "label": "Bayesian optimization",
            "status": "planned",
            "examples": ["expensive black-box function"],
            "visualizations": ["surrogate_model", "acquisition", "sample_history"],
        },
        {
            "id": "noisy",
            "label": "Noisy optimization",
            "status": "planned",
            "examples": ["stochastic evaluation", "simulation with measurement noise"],
            "visualizations": ["confidence_bands", "replicate_distribution", "robust_convergence"],
        },
        {
            "id": "drawable",
            "label": "Drawable fitness landscape",
            "status": "planned",
            "examples": ["mouse-painted objective surface"],
            "visualizations": ["canvas_landscape", "animated_search_path"],
        },
    ]
