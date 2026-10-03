use arrow::compute::{cast, concat_batches};
use arrow_array::RecordBatch;
use arrow_schema::{ArrowError, DataType, Field, Schema};
use std::sync::Arc;

fn unview_type(dt: &DataType) -> DataType {
    match dt {
        DataType::Utf8View => DataType::Utf8,
        DataType::BinaryView => DataType::Binary,
        DataType::List(f) => DataType::List(unview_field(f)),
        DataType::LargeList(f) => DataType::LargeList(unview_field(f)),
        DataType::FixedSizeList(f, n) => DataType::FixedSizeList(unview_field(f), *n),
        DataType::Struct(fs) => DataType::Struct(fs.iter().map(unview_field).collect()),
        DataType::Dictionary(k, v) => DataType::Dictionary(k.clone(), Box::new(unview_type(v))),
        other => other.clone(),
    }
}

fn unview_field(f: &Arc<Field>) -> Arc<Field> {
    Arc::new(
        f.as_ref()
            .clone()
            .with_data_type(unview_type(f.data_type())),
    )
}

pub fn compact(batches: &[RecordBatch]) -> Result<RecordBatch, ArrowError> {
    let old = batches[0].schema();
    let schema = Arc::new(Schema::new_with_metadata(
        old.fields().iter().map(unview_field).collect::<Vec<_>>(),
        old.metadata().clone(),
    ));

    let converted = batches
        .iter()
        .map(|b| {
            let cols = b
                .columns()
                .iter()
                .zip(schema.fields())
                .map(|(c, f)| cast(c, f.data_type()))
                .collect::<Result<Vec<_>, _>>()?;
            RecordBatch::try_new(schema.clone(), cols)
        })
        .collect::<Result<Vec<_>, _>>()?;

    concat_batches(&schema, &converted)
}
