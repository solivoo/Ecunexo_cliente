import { expect, type Page } from '@playwright/test'

export async function selectGluOption(
  page: Page,
  selectId: string,
  optionText: RegExp | string
): Promise<void> {
  const trigger = page.locator(`#${selectId}`)
  await expect(trigger).toBeVisible({ timeout: 20_000 })
  await trigger.click()
  const option = page.getByRole('option', { name: optionText }).first()
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()
}
