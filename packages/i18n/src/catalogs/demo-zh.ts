import type { DemoMessages } from './marketing-types.ts';

// 产品导览（简体中文）。
export const demoZh: DemoMessages = {
  demo: {
    metaTitle: 'TeacherHubPro 演示：一步步看遍所有功能',
    metaDescription:
      '用真实界面带您逐步了解 TeacherHubPro：教案、出勤、AI 评分、游戏、实时游戏、家长门户等。',
    title: '一步步了解 TeacherHubPro',
    intro: '用 {steps} 个步骤和真实界面，带您逐步了解整个应用。您看到的所有学生都是虚构的。',
    contents: '章节',
    chapterNumber: '第 {n} 章',
    enlarge: '打开原尺寸截图：{title}',
    madeUp: '这些截图中的姓名、班级和成绩均为虚构。AI 草稿由应用内的 AI 撰写，并按原样展示。',
    video: {
      introTitle: '两分钟了解 TeacherHubPro',
      introLine:
        '欢迎使用 TeacherHubPro，这是为教师、学校和在家教育家庭打造的 AI 教学工作台。下面快速看看它能做什么。',
      outroTitle: '免费试用 {days} 天',
      outroLine: '在 teacherhubpro.com 免费试用 TeacherHubPro {days} 天，无需银行卡。',
      madeUp: '画面中的所有学生均为虚构。',
    },
    chapters: {
      start: {
        title: '快速上手',
        intro: '一分钟完成注册，从现成的示例班级开始。',
      },
      classes: {
        title: '班级、学生名单和出勤',
        intro: '从电子表格导入学生，几秒钟完成点名。',
      },
      planning: {
        title: '备课',
        intro: '符合 Common Core 和波多黎各标准的每周计划，可直接打印。',
      },
      assistant: {
        title: 'AI 助手',
        intro: '按您的年级和主题起草练习单、测验和评分量规。由您修改，由您决定。',
      },
      presentations: {
        title: '演示文稿',
        intro: 'AI 起草的幻灯片，可直接演示，或在 Google Slides、Canva 或 OneDrive 中打开。',
      },
      prep: {
        title: '备课助手',
        intro: '一句话生成一整周的内容，发出前每一项都由您审阅。',
      },
      assignments: {
        title: '作业和 AI 评分',
        intro: '把 PDF 变成在线作业，通过链接分享，并确认 AI 建议的成绩。',
      },
      gradebook: {
        title: '成绩册和成绩单',
        intro: '加权类别、学期和成绩单，全部基于您确认过的成绩。',
      },
      games: {
        title: '教育游戏',
        intro: '十一种游戏模式，每个答案都有解释，并按标准跟踪掌握情况。',
      },
      live: {
        title: '课堂实时游戏',
        intro: '在大屏幕上一起玩，学生用手机作答。',
      },
      learning: {
        title: '自适应学习和学生洞察',
        intro: '个人学习路径，及早发现可能需要帮助的学生。',
      },
      families: {
        title: '家长门户',
        intro: '家长通过私密链接查看成绩和出勤，无需注册账户。',
      },
      substitutes: {
        title: '代课资料包',
        intro: '代课老师需要的一切，一键打印。',
      },
      connections: {
        title: '已连接的工具',
        intro: '可与 Google、Microsoft、Canva 以及学校的课程平台配合使用。',
      },
      schools: {
        title: '面向学校和学区',
        intro: '使用情况、管理设置、AI 审批记录和您的数据，尽在一处。',
      },
    },
    steps: {
      signup: {
        title: '创建账户',
        text: '用电子邮箱或 Google 账户注册。免费试用立即开始，无需绑定银行卡。',
        alt: 'TeacherHubPro 注册页面，包含姓名、电子邮箱和密码字段。',
      },
      commandCenter: {
        title: '您的指挥中心',
        text: '每天早上，今天的课程、待批改的作业和可能需要帮助的学生，都在同一个屏幕上一目了然。',
        alt: '指挥中心，显示今天的课程、待批改的作业和一名可能需要帮助的学生。',
      },
      sampleClass: {
        title: '用示例班级试一试',
        text: '一键添加示例班级，包含虚构的学生、成绩和出勤，让您在添加自己的班级之前先试用所有功能。随时可以移除。',
        alt: '示例班级页面，有六名虚构学生。',
      },
      rosterImport: {
        title: '导入学生名单',
        text: '上传包含名字和姓氏的电子表格。学号、家长邮箱、特殊照顾措施和家庭语言都是可选列。',
        alt: '从电子表格导入学生后的班级名单。',
      },
      accommodations: {
        title: '特殊照顾措施集中记录',
        text: '每位学生的特殊照顾措施只需记录一次。它们会出现在需要的地方，比如代课资料包，并且只对您和您的学校可见。',
        alt: '学生编辑表单，已填写特殊照顾措施字段。',
      },
      attendance: {
        title: '几秒钟完成点名',
        text: '为每位学生标记出勤、缺勤、迟到或请假，填写迟到分钟数，然后保存当天记录。',
        alt: '点名表，每位学生都有一个状态。',
      },
      attendanceReport: {
        title: '出勤情况一目了然',
        text: '出勤报告显示所选日期内每位学生的出勤率，以及每一次缺勤和迟到。',
        alt: '出勤报告，显示每位学生的出勤率。',
      },
      planner: {
        title: '按标准规划一周',
        text: '逐日撰写每周计划，并从 Common Core 和波多黎各的官方标准列表中选择标准。应用绝不会编造标准代码。',
        alt: '每周教案规划器，已打开波多黎各标准选择器。',
      },
      planPrint: {
        title: '按学校格式打印',
        text: '用带有学校抬头的经典格式打印计划，或使用简洁的单页格式。',
        alt: '一份可按经典格式打印的每周教案。',
      },
      curriculum: {
        title: '添加课程指南',
        text: '上传或粘贴学校的进度指南。AI 起草计划时会遵循它们，让草稿与学校的教学内容一致。',
        alt: '课程指南页面，有一份可直接使用的进度指南。',
      },
      templates: {
        title: '从模板开始',
        text: '从现成的单元或您自己的模板开始一份计划，然后随意修改。',
        alt: '模板页面，显示现成的单元。',
      },
      assistantForm: {
        title: '向 AI 助手提问',
        text: '选择练习单、测验或教案，再选择学科、年级、主题和语言。勾选 ESL 支持，即可按照 WIDA 和波多黎各标准，生成适合英语学习者水平的材料。',
        alt: 'AI 助手表单，包含类型、主题、年级和 ESL 支持。',
      },
      assistantResult: {
        title: '审阅草稿',
        text: '草稿几秒钟就能完成。可以复制、打印、朗读，在 Canva 中打开或保存到 OneDrive。',
        alt: 'AI 助手起草的一份练习单。',
      },
      rubric: {
        title: '制作评分量规',
        text: '从零开始制作评分量规，或让 AI 起草一份，然后修改每一项标准和等级。用它来批改书面答案。',
        alt: '一份包含标准和等级、可供修改的评分量规。',
      },
      presentation: {
        title: '起草演示文稿',
        text: '输入主题和幻灯片数量，选择主题样式，在演示前修改每一张幻灯片。',
        alt: 'AI 起草的演示文稿，已在幻灯片编辑器中打开。',
      },
      presentationExport: {
        title: '随处演示',
        text: '在浏览器中演示，下载 PowerPoint，发送到 Google Classroom 和 Slides，在 Canva 中打开，或保存到 OneDrive。',
        alt: '演示文稿的选项：发送到 Google Classroom、Canva 和 OneDrive。',
      },
      prepStart: {
        title: '一句话，一整周',
        text: '输入您这周要教的内容。备课助手会为每一天起草计划、幻灯片和练习单，外加周五小测和一封给家长的信。',
        alt: '备课助手表单，用一句话描述这一周。',
      },
      prepReview: {
        title: '发出之前，由您审阅',
        text: '逐项阅读，决定保留或删除，并修改发给家长的邮件。在您同意之前，不会发布或发送任何内容。',
        alt: '备课助手的审阅页面，包含本周计划、练习单、测验和家长邮件。',
      },
      pdfImport: {
        title: '把 PDF 变成在线作业',
        text: '上传 PDF 格式的练习单或试卷。AI 会把其中的题目读入编辑器，您在保存前逐题检查。',
        alt: '从 PDF 导入的题目，等待检查和保存。',
      },
      studentLinks: {
        title: '用学生链接分享',
        text: '每位学生都有一个私密链接：无需管理账户或密码。您可以随时更换或停用链接。',
        alt: '学生链接页面，每位学生都有一个链接。',
      },
      studentAnswer: {
        title: '学生用任何设备作答',
        text: '学生在手机、平板或电脑上打开自己的链接，作答并提交。题目可以朗读。',
        alt: '一名学生在手机上完成作业。',
      },
      aiGrading: {
        title: 'AI 建议，您来决定',
        text: '选择题自动计分。对于书面答案，AI 会建议分数和反馈，在您确认或修改之前都不计入成绩。',
        alt: '一名学生的答案，附有 AI 建议的分数，等待教师确认。',
      },
      gradebook: {
        title: '准确无误的成绩册',
        text: '加权类别、每位学生的总评成绩，并且只包含您确认过的成绩。',
        alt: '成绩册，显示各类别和每位学生的总评成绩。',
      },
      reportCards: {
        title: '几分钟完成成绩单',
        text: '为每位学生添加评语，并以 PDF 格式下载成绩单，可逐个下载，也可下载全班。',
        alt: '成绩单，显示按类别划分的成绩和教师评语。',
      },
      gameBuilder: {
        title: '几分钟做好一个游戏',
        text: '自己出题或让 AI 起草题目，然后从十一种模式中选择，例如测验、限时挑战、配对、记忆翻牌和填字游戏。',
        alt: '游戏编辑器，显示题目卡片。',
      },
      gameReview: {
        title: '学生知道为什么',
        text: '每轮结束后，学生会看到答错的题目、正确答案以及简短的原因解释。',
        alt: '一名学生在游戏后的回顾，显示正确答案和解释。',
      },
      aiExplanations: {
        title: '替您写好的解释',
        text: '一键让 AI 为每张还没有解释的卡片写一段简短的“为什么”。保存前由您阅读和修改。',
        alt: 'AI 撰写的解释，等待教师审阅。',
      },
      coverage: {
        title: '查看已覆盖的标准',
        text: '标准覆盖情况报告显示全班在您标记的每项标准上的表现，一键即可重新讲解需要加强的内容。',
        alt: '一个班级的标准覆盖情况报告。',
      },
      liveLobby: {
        title: '开始实时游戏',
        text: '把游戏投到大屏幕上。学生输入 6 位数 PIN 加入，并在您的学生名单中点选自己的名字。',
        alt: '实时游戏大厅，显示 PIN 和已加入的学生。',
      },
      livePlayer: {
        title: '学生用手机玩',
        text: '每位学生在自己的设备上限时作答，答得快、连续答对都能加分。',
        alt: '一名学生在手机上回答实时游戏题目。',
      },
      liveReveal: {
        title: '揭晓、讲解、继续',
        text: '每道题结束后，大屏幕会显示正确答案、全班的作答情况和原因，然后是排行榜。',
        alt: '大屏幕显示正确答案、全班的作答情况和解释。',
      },
      learningPath: {
        title: '个人学习路径',
        text: '针对学生需要的主题，为其起草一组简短的课程。您修改后，再布置到该学生的链接上。',
        alt: '为一名学生起草的学习路径，已在编辑器中打开。',
      },
      studentLesson: {
        title: '按学生自己的节奏学习',
        text: '学生阅读每节课，完成一个小检测，并看到自己的分数。您可以看到他们的进度。',
        alt: '一名学生在手机上学习一节课。',
      },
      insights: {
        title: '了解谁可能需要帮助',
        text: '每位学生的页面汇集了成绩、出勤和备注。AI 摘要会建议下一步，供您参考。',
        alt: '一名学生的页面，显示成绩、出勤和 AI 摘要。',
      },
      parentPortal: {
        title: '让家长随时了解情况',
        text: '家长打开私密链接，即可查看已确认的成绩和出勤。备课助手的每周通知可以用每个家庭自己的语言发送。',
        alt: '手机上的家长门户，显示成绩和出勤。',
      },
      subPacket: {
        title: '随时为代课做好准备',
        text: '代课资料包汇集您的课表、学生名单、计划、课堂常规和联系方式，可直接打印。',
        alt: '一份代课资料包，包含课表、学生名单和课堂常规。',
      },
      integrations: {
        title: '连接您的工具',
        text: '连接 Google Classroom、Google Drive、Microsoft OneDrive 和 Teams、Canva 以及您的日历。共享哪些内容由您决定，一次一个工具。',
        alt: '“已连接的工具”页面，显示 Google、Microsoft 和 Canva。',
      },
      schoolSystems: {
        title: '学校的课程平台',
        text: '学校可以通过 LTI 1.3 标准，在 Canvas、Schoology、Moodle 和 D2L Brightspace 中打开 TeacherHubPro，并回传已确认的成绩。按需开通。',
        alt: '“已连接的工具”中的学校系统部分。',
      },
      schoolOverview: {
        title: '学校概览',
        text: '学校领导可以看到每位教师使用应用的情况，并能为全校开启或关闭 AI 功能和学生提醒标记。',
        alt: '学校概览，显示各教师的使用情况和全校开关。',
      },
      schoolUsers: {
        title: '管理学校用户',
        text: '为教师和管理员分配合适的角色，有人离开时把班级转给另一位教师。',
        alt: '学校用户页面，显示各自的角色。',
      },
      approvals: {
        title: '每项 AI 决定都有记录',
        text: 'AI 生成的内容只有在教师批准后才会送达学生和家庭。审批记录显示谁在何时批准了什么，不含学生姓名或成绩。',
        alt: '审批记录，列出教师批准的内容。',
      },
      dataExport: {
        title: '您的数据归您所有',
        text: '随时下载学校的全部数据，或自行删除学校及其数据。',
        alt: '设置页面，显示学校数据的下载和删除选项。',
      },
      languages: {
        title: '七种语言',
        text: '可使用英语、西班牙语、法语、葡萄牙语、德语、意大利语或中文界面。AI 会用您选择的语言撰写内容。',
        alt: '设置页面，显示语言选择器。',
      },
    },
  },
};
