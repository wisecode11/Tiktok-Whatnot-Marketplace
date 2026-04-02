"use client"

import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { DataTable } from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react"
import { mockProducts } from "@/lib/mock-data"

const columns = [
  {
    key: "name",
    header: "Product",
    cell: (row: typeof mockProducts[0]) => (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.sku}</div>
        </div>
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
  },
  {
    key: "price",
    header: "Price",
    cell: (row: typeof mockProducts[0]) => `$${row.price.toFixed(2)}`,
  },
  {
    key: "stock",
    header: "Stock",
    cell: (row: typeof mockProducts[0]) => (
      <span
        className={
          row.stock === 0
            ? "text-destructive"
            : row.stock < 30
            ? "text-amber-400"
            : ""
        }
      >
        {row.stock}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row: typeof mockProducts[0]) => (
      <StatusBadge
        variant={
          row.status === "active"
            ? "success"
            : row.status === "low_stock"
            ? "warning"
            : "danger"
        }
      >
        {row.status === "out_of_stock"
          ? "Out of Stock"
          : row.status === "low_stock"
          ? "Low Stock"
          : "Active"}
      </StatusBadge>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "w-12",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export default function SellerProducts() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your product inventory"
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{mockProducts.length}</div>
            <div className="text-sm text-muted-foreground">Total Products</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {mockProducts.filter((p) => p.status === "active").length}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">
              {mockProducts.filter((p) => p.status === "low_stock").length}
            </div>
            <div className="text-sm text-muted-foreground">Low Stock</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">
              {mockProducts.filter((p) => p.status === "out_of_stock").length}
            </div>
            <div className="text-sm text-muted-foreground">Out of Stock</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="bg-muted/50 pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px] bg-muted/50">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="accessories">Accessories</SelectItem>
              <SelectItem value="bags">Bags</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[140px] bg-muted/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products Table */}
      <DataTable columns={columns} data={mockProducts} />
    </div>
  )
}
