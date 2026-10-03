import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { canManageBot, MANAGEMENT_DENIED } from './permissions.js';
import { themedEmbed } from './appearance.js';
import { readSpamSettings, spamDuration, MAX_SPAM_SECONDS, MAX_SPAM_AMOUNT } from './spam-settings.js';

export function buildSpamCommand() {
  return new SlashCommandBuilder().setName('خصم').setDescription('للإدارة: تحديد مدة السبام ومبلغ الخصم أو عرض الإعدادات الحالية')
    .setDefaultMemberPermissions(null)
    .addIntegerOption(o => o.setName('المدة').setDescription('المدة بالثواني؛ الرسائل المتتالية بفاصل أقل منها تُحسب سبام')
      .setMinValue(1).setMaxValue(MAX_SPAM_SECONDS))
    .addIntegerOption(o => o.setName('المبلغ').setDescription('مبلغ الخصم لكل مخالفة سبام؛ يتوقف الرصيد عند صفر')
      .setMinValue(1).setMaxValue(MAX_SPAM_AMOUNT));
}

export function createSpamHandler({ config, store, service, access, onError }) {
  return async interaction => {
    if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'خصم') return false;
    if (!canManageBot(interaction, config, access?.roleId)) {
      await interaction.reply({ content: MANAGEMENT_DENIED, flags: MessageFlags.Ephemeral }); return true;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const seconds = interaction.options.getInteger('المدة'), amount = interaction.options.getInteger('المبلغ');
      const changed = seconds != null || amount != null;
      const settings = await store.settings();
      const rule = changed ? await service.configureSpam({ seconds, amount,
        actorId: interaction.user.id, operationId: interaction.id }) : readSpamSettings(settings?.spam);
      const embed = themedEmbed(changed ? 'تم تحديث خصم السبام' : 'إعدادات خصم السبام', settings?.appearance)
        .setDescription(`الرسالة التالية من العضو في الشات نفسه بفاصل أقل من **${spamDuration(rule.windowMs)}** تُحسب سبام.\n`
          + 'يُخصم المبلغ المحدد أو المتبقي من الرصيد، ويقف الرصيد عند **0**.')
        .addFields({ name: 'مدة السبام', value: `**${spamDuration(rule.windowMs)}**`, inline: true },
          { name: 'مبلغ الخصم', value: `**${rule.amount.toLocaleString('en-US')} $**`, inline: true })
        .setFooter({ text: 'الإعدادات محفوظة بعد إعادة التشغيل • التغييرات تطبق على المخالفات الجديدة' });
      await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      onError?.(error);
      await interaction.editReply({ content: `❌ ${error.message}`, allowedMentions: { parse: [] } });
    }
    return true;
  };
}
