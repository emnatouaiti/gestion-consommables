<?php

namespace App\Repositories;

use App\Interfaces\ProductRepositoryInterface;
use App\Models\Product;

class EloquentProductRepository implements ProductRepositoryInterface
{
    public function find(int $id)
    {
        return Product::find($id);
    }

    public function all(array $filters = [])
    {
        $query = Product::query();
        // Apply filters if needed
        return $query->get();
    }

    public function create(array $data)
    {
        return Product::create($data);
    }

    public function update(int $id, array $data)
    {
        $product = Product::findOrFail($id);
        $product->update($data);
        return $product;
    }

    public function delete(int $id): bool
    {
        $product = Product::findOrFail($id);
        return (bool) $product->delete();
    }
}
