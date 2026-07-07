<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
  {filteredProducts.map((product) => (
    <button
      key={product.id}
      onClick={() => addToCart(product)}
      className="border rounded-lg p-3 text-left hover:bg-accent transition-colors disabled:opacity-50 flex flex-col items-center"
      disabled={product.current_stock <= 0}
    >
      {/* Product image */}
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-16 h-16 object-cover rounded-md mb-2"
        />
      ) : (
        <div className="w-16 h-16 rounded-md mb-2 bg-muted flex items-center justify-center text-muted-foreground text-xs">
          Hakuna
        </div>
      )}
      <div className="font-medium text-sm text-center">{product.name}</div>
      <div className="text-xs text-muted-foreground">
        {formatCurrency(product.selling_price)}
      </div>
      <div
        className={`text-xs ${product.current_stock <= product.minimum_stock ? "text-red-500" : "text-green-600"}`}
      >
        Stock: {product.current_stock}
      </div>
    </button>
  ))}
</div>
