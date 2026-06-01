<?php

namespace App\Interfaces;

interface ProductRepositoryInterface
{
    public function find(int $id);

    public function all(array $filters = []);

    public function create(array $data);

    public function update(int $id, array $data);

    public function delete(int $id): bool;
}
