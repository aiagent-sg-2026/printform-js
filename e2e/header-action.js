export async function clickHeaderAction(page,action) {
  const button=page.locator(action==='update'?'#update-button':`[data-action="${action}"]`);
  if (!await button.isVisible()) {
    const more=page.getByRole('button',{name:'More actions',exact:true});
    if (await more.getAttribute('aria-expanded')!=='true') await more.click();
  }
  await button.click();
}
