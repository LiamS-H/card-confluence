use datafusion::common::tree_node::{Transformed, TreeNode};
use datafusion::logical_expr::LogicalPlan;
use datafusion::logical_expr::utils::{conjunction, split_conjunction_owned};

// 1. Mutate a cloned plan strictly for cache normalization
pub fn canonicalize_for_cache(plan: LogicalPlan) -> datafusion::common::Result<LogicalPlan> {
    plan.transform_up(|node| match node {
        LogicalPlan::Filter(mut f) => {
            // Use _owned so the Exprs can be consumed by conjunction()
            let mut exprs = split_conjunction_owned(f.predicate);

            exprs.sort_by_key(|e| e.to_string());

            f.predicate =
                conjunction(exprs).expect("split_conjunction_owned never returns an empty Vec");
            Ok(Transformed::yes(LogicalPlan::Filter(f)))
        }
        _ => Ok(Transformed::no(node)),
    })
    .map(|t| t.data)
}
