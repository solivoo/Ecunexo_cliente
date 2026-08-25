using EcuNexo.Business.Platform;
using EcuNexo.Core.Platform.Navigation;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class MenuItemRepository(EcuNexoDbContext dbContext) : IMenuItemRepository
{
    public async Task<IReadOnlyList<MenuItem>> ListActiveAsync(
        MenuContextKind? context,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.MenuItems.AsNoTracking().Where(x => x.IsActive);

        if (context.HasValue)
        {
            query = query.Where(x => x.Context == context.Value);
        }

        return await query.OrderBy(x => x.SortOrder).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<MenuItem>> ListAsync(
        MenuContextKind? context,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.MenuItems.AsNoTracking().AsQueryable();

        if (activeOnly)
        {
            query = query.Where(x => x.IsActive);
        }

        if (context.HasValue)
        {
            query = query.Where(x => x.Context == context.Value);
        }

        return await query.OrderBy(x => x.SortOrder).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<MenuItem?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        await dbContext.MenuItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken).ConfigureAwait(false);

    public async Task AddAsync(MenuItem item, CancellationToken cancellationToken = default)
    {
        dbContext.MenuItems.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task UpdateAsync(MenuItem item, CancellationToken cancellationToken = default)
    {
        dbContext.MenuItems.Update(item);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.MenuItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            .ConfigureAwait(false);
        if (item is null)
        {
            return;
        }

        dbContext.MenuItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
