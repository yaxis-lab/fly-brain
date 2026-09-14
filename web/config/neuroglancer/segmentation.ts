export const segmentation_multires_meshes_info = {
  "@type": "neuroglancer_multilod_draco",
  lod_scale_multiplier: 1.0,
  sharding: {
    "@type": "neuroglancer_uint64_sharded_v1",
    data_encoding: "gzip",
    hash: "murmurhash3_x86_128",
    minishard_bits: 8,
    minishard_index_encoding: "gzip",
    preshift_bits: 6,
    shard_bits: 10,
  },
  transform: [16.0, 0.0, 0.0, 0.0, 0.0, 16.0, 0.0, 0.0, 0.0, 0.0, 16.0, 0.0],
  vertex_quantization_bits: 16,
};
