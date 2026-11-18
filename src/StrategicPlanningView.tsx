import React, { useState, useEffect } from 'react';
import { apiFetch } from './apiClient';
import {
  Compass,
  Layers,
  CheckSquare,
  Plus,
  Save,
  X,
  Copy,
  CheckCircle,
  FileText,
  BarChart2,
  ListOrdered,
  ArrowRight,
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  MessageSquare,
  Lock,
  History,
  Trash2,
  Edit,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Check,
  Send,
  Flag,
  Sparkles,
  ShieldAlert,
  FolderKanban
} from 'lucide-react';
import {
  StrategicPlan,
  StrategicInitiative,
  StrategicActivity,
  StrategicPerspective,
  StrategicGoal,
  ChatterMessage
} from './types/strategicPlanning';
import { ScreenSchemaConfig } from './types/adminSettings';
import { Language, translations, translateStatus, pickLocalized, translateOptionLabel, translateRole } from './i18n';

interface StrategicPlanningViewProps {
  lang: Language;
  onNavigateToProjects?: () => void;
  showBanner: (type: 'success' | 'error', text: string) => void;
  currentUserRole?: string;
  currentUserName?: string;
  screenSchemas?: Record<string, ScreenSchemaConfig>;
}

type StrategicEntityTab = 'plans' | 'initiatives' | 'activities';
type ViewMode = 'list' | 'form';

export const StrategicPlanningView: React.FC<StrategicPlanningViewProps> = ({
  lang,
  onNavigateToProjects,
  showBanner,
  currentUserRole = 'PMO Manager',
  currentUserName,
  screenSchemas
}) => {
  const t = translations[lang];
  const resolvedUserName = currentUserName || (lang === 'ar' ? 'إلينا فانس' : 'Elena Vance');

  // Dynamic Screen Schemas from Admin Settings
  const [adminSchemas, setAdminSchemas] = useState<Record<string, ScreenSchemaConfig>>(screenSchemas || {});

  useEffect(() => {
    if (screenSchemas) {
      setAdminSchemas(screenSchemas);
    } else {
      apiFetch('/api/admin/settings')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.screenSchemas) setAdminSchemas(data.screenSchemas);
        })
        .catch(() => {});
    }
  }, [screenSchemas]);

  const getLabel = (screenId: string, key: string, fallbackAr: string, fallbackEn: string) => {
    const schema = adminSchemas[screenId];
    const field = schema?.fields.find((f) => f.key === key);
    if (!field) return lang === 'ar' ? fallbackAr : fallbackEn;
    return lang === 'ar' ? field.labelAr || fallbackAr : field.labelEn || fallbackEn;
  };

  const isVisible = (screenId: string, key: string) => {
    const schema = adminSchemas[screenId];
    if (!schema?.fields || schema.fields.length === 0) return true;
    const field = schema.fields.find((f) => f.key === key);
    if (!field) return false; // The field was deleted!
    return field.visible !== false;
  };

  const getFieldOptions = (screenId: string, key: string, fallback: string[]): string[] => {
    const schema = adminSchemas[screenId];
    const field = schema?.fields?.find((f) => f.key === key);
    if (field && field.options && field.options.length > 0) {
      if (lang === 'en' && field.optionsEn && field.optionsEn.length > 0) {
        return field.optionsEn;
      }
      return field.options;
    }
    return fallback;
  };

  const getCustomFields = (screenId: string) => {
    const schema = adminSchemas[screenId];
    if (!schema?.fields) return [];
    return schema.fields.filter((f) => f.isCustom && f.visible !== false);
  };

  // Active top-level entity tab
  const [activeTab, setActiveTab] = useState<StrategicEntityTab>('plans');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Loading and data states
  const [loading, setLoading] = useState<boolean>(false);
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [initiatives, setInitiatives] = useState<StrategicInitiative[]>([]);
  const [activities, setActivities] = useState<StrategicActivity[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; nameAr?: string; nameEn?: string }>>([]);

  // Selected item IDs for Form View
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isPlanEditing, setIsPlanEditing] = useState<boolean>(true);
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<number | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);

  // Active Sub-Tab in Plan Form: 'perspectives' | 'goals' | 'seminarCard'
  const [planSubTab, setPlanSubTab] = useState<'perspectives' | 'goals' | 'seminarCard'>('perspectives');

  // Active Sub-Tab in Activity Chatter: 'message' | 'internal_note' | 'audit_log'
  const [chatterType, setChatterType] = useState<'message' | 'internal_note' | 'audit_log'>('message');
  const [chatterText, setChatterText] = useState<string>('');

  // Report Modals
  const [perspectivesReportOpen, setPerspectivesReportOpen] = useState(false);
  const [goalsReportOpen, setGoalsReportOpen] = useState(false);

  // Form State for Strategic Plan
  const [planFormData, setPlanFormData] = useState<Partial<StrategicPlan>>({
    titleAr: '',
    titleEn: '',
    cycle: '2026 - 2030',
    yearsRange: ['2026', '2027', '2028', '2029', '2030'],
    planType: 'خطة خمسية استراتيجية',
    vision: '',
    mission: '',
    description: '',
    strategicIssues: ['الاستدامة المالية والتمويل المبتكر', 'التحول الرقمي وأتمتة الخدمات'],
    values: ['الشفافية', 'الابتكار', 'الاستدامة'],
    perspectives: [],
    goals: [],
    seminarCard: {},
    status: 'Draft'
  });

  // Form State for Initiative
  const [initFormData, setInitFormData] = useState<Partial<StrategicInitiative>>({
    title: '',
    code: '',
    domains: ['التحول الرقمي', 'الصناعات الإبداعية'],
    planId: 1,
    departmentId: 1,
    section: 'قسم التخطيط الاستراتيجي',
    planType: 'خطة خمسية استراتيجية',
    indicator: '',
    goalId: '',
    organizationUnit: 'الصندوق الثقافي',
    cycle: '2026 - 2030',
    years: ['2026'],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'Draft'
  });

  // Form State for Activity
  const [actFormData, setActFormData] = useState<Partial<StrategicActivity>>({
    name: '',
    source: 'أساس',
    domains: ['التحول الرقمي'],
    indicator: '',
    initiativeId: 1,
    departmentId: 1,
    section: 'قسم التخطيط والمتابعة',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
    targetValue: 100,
    activityValue: 500000.0,
    isDevelopmentalProject: true,
    isExecutiveBodyActivity: true,
    status: 'Draft',
    chatter: []
  });

  // New perspective/goal row buffer
  const [newPerspName, setNewPerspName] = useState('');
  const [newPerspWeight, setNewPerspWeight] = useState(25);
  const [newGoalPerspId, setNewGoalPerspId] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalWeight, setNewGoalWeight] = useState(15);
  const [newGoalCode, setNewGoalCode] = useState('');

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, initsRes, actsRes, deptsRes] = await Promise.all([
        apiFetch('/api/strategic-planning/plans'),
        apiFetch('/api/strategic-planning/initiatives'),
        apiFetch('/api/strategic-planning/activities'),
        apiFetch('/api/departments')
      ]);

      if (plansRes.ok) setPlans(await plansRes.json());
      if (initsRes.ok) setInitiatives(await initsRes.json());
      if (actsRes.ok) setActivities(await actsRes.json());
      if (deptsRes.ok) setDepartments(await deptsRes.json());
    } catch (err) {
      console.error('Failed to load strategic planning data:', err);
      showBanner('error', lang === 'ar' ? 'فشل تحميل بيانات التخطيط الاستراتيجي' : 'Failed to load strategic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When selected Plan changes in Form Mode, load into planFormData
  useEffect(() => {
    if (selectedPlanId) {
      const found = plans.find((p) => p.id === selectedPlanId);
      if (found) {
        setPlanFormData(JSON.parse(JSON.stringify(found)));
      }
    }
  }, [selectedPlanId, plans]);

  // When selected Initiative changes in Form Mode, load into initFormData
  useEffect(() => {
    if (selectedInitiativeId) {
      const found = initiatives.find((i) => i.id === selectedInitiativeId);
      if (found) {
        setInitFormData(JSON.parse(JSON.stringify(found)));
      }
    }
  }, [selectedInitiativeId, initiatives]);

  // When selected Activity changes in Form Mode, load into actFormData
  useEffect(() => {
    if (selectedActivityId) {
      const found = activities.find((a) => a.id === selectedActivityId);
      if (found) {
        setActFormData(JSON.parse(JSON.stringify(found)));
      }
    }
  }, [selectedActivityId, activities]);

  // Handlers for Strategic Plan
  const handleNewPlan = () => {
    setSelectedPlanId(null);
    setPlanFormData({
      titleAr: '',
      titleEn: '',
      cycle: '2026 - 2030',
      yearsRange: ['2026', '2027', '2028', '2029', '2030'],
      planType: lang === 'ar' ? 'خطة خمسية استراتيجية' : 'Strategic 5-Year Plan',
      vision: '',
      visionEn: '',
      mission: '',
      missionEn: '',
      description: '',
      descriptionEn: '',
      strategicIssues: ['الاستدامة المالية والتمويل المبتكر', 'التحول الرقمي وأتمتة الخدمات'],
      strategicIssuesEn: ['Financial Sustainability & Innovative Funding', 'Digital Transformation & Service Automation'],
      values: ['الشفافية', 'الابتكار', 'الاستدامة'],
      valuesEn: ['Transparency', 'Innovation', 'Sustainability'],
      perspectives: [
        { id: 'p1', name: 'المنظور المالي والاستدامة', nameEn: 'Financial & Sustainability Perspective', weight: 30 },
        { id: 'p2', name: 'منظور المستفيدين وأصحاب المصلحة', nameEn: 'Stakeholders & Beneficiaries Perspective', weight: 25 },
        { id: 'p3', name: 'منظور العمليات الداخلية والحوكمة', nameEn: 'Internal Processes & Governance Perspective', weight: 25 },
        { id: 'p4', name: 'منظور التعلم والنمو ورأس المال البشري', nameEn: 'Learning, Growth & Human Capital Perspective', weight: 20 }
      ],
      goals: [],
      seminarCard: {
        organizer: 'الإدارة العامة للاستراتيجية',
        organizerEn: 'General Directorate of Strategy',
        venue: 'المقر الرئيسي',
        venueEn: 'Headquarters',
        sessionDate: '2026-01-15',
        executiveSummary: 'جلسة تدشين الخطة الاستراتيجية المؤسسية',
        executiveSummaryEn: 'Institutional Strategic Plan Launch Session'
      },
      status: 'Draft'
    });
    setIsPlanEditing(true);
    setViewMode('form');
  };

  const handleSavePlan = async () => {
    if (!planFormData.titleAr && !planFormData.titleEn) {
      showBanner('error', lang === 'ar' ? 'يرجى إدخال اسم الخطة الاستراتيجية' : 'Please enter plan title');
      return;
    }

    setIsSavingPlan(true);
    try {
      if (selectedPlanId) {
        const res = await apiFetch(`/api/strategic-planning/plans/${selectedPlanId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planFormData)
        });
        if (res.ok) {
          const updated = await res.json();
          setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setPlanFormData(JSON.parse(JSON.stringify(updated)));
          setIsPlanEditing(false);
          showBanner('success', lang === 'ar' ? 'تم حفظ الخطة الاستراتيجية بنجاح' : 'Strategic plan saved successfully');
          fetchData();
        } else {
          const err = await res.json().catch(() => ({}));
          showBanner('error', err.message || (lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving strategic plan'));
        }
      } else {
        const res = await apiFetch('/api/strategic-planning/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(planFormData)
        });
        if (res.ok) {
          const created = await res.json();
          setPlans((prev) => [created, ...prev]);
          setSelectedPlanId(created.id);
          setPlanFormData(JSON.parse(JSON.stringify(created)));
          setIsPlanEditing(false);
          showBanner('success', lang === 'ar' ? 'تم إنشاء وحفظ الخطة الاستراتيجية بنجاح' : 'Strategic plan saved successfully');
          fetchData();
        } else {
          const err = await res.json().catch(() => ({}));
          showBanner('error', err.message || (lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving strategic plan'));
        }
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving strategic plan');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Add perspective row
  const handleAddPerspective = () => {
    if (!newPerspName.trim()) return;
    const newP: StrategicPerspective = {
      id: `p_${Date.now()}`,
      name: newPerspName.trim(),
      weight: Number(newPerspWeight) || 0
    };
    setPlanFormData((prev) => ({
      ...prev,
      perspectives: [...(prev.perspectives || []), newP]
    }));
    setNewPerspName('');
    setNewPerspWeight(20);
  };

  const handleRemovePerspective = (pId: string) => {
    setPlanFormData((prev) => ({
      ...prev,
      perspectives: (prev.perspectives || []).filter((p) => p.id !== pId),
      goals: (prev.goals || []).filter((g) => g.perspectiveId !== pId)
    }));
  };

  // Add goal row
  const handleAddGoal = () => {
    if (!newGoalTitle.trim() || !newGoalPerspId) return;
    const targetPersp = (planFormData.perspectives || []).find((p) => p.id === newGoalPerspId);
    const newG: StrategicGoal = {
      id: `g_${Date.now()}`,
      perspectiveId: newGoalPerspId,
      perspectiveName: targetPersp ? targetPersp.name : '',
      title: newGoalTitle.trim(),
      weight: Number(newGoalWeight) || 0,
      code: newGoalCode.trim() || `GOAL-${(planFormData.goals || []).length + 1}`
    };
    setPlanFormData((prev) => ({
      ...prev,
      goals: [...(prev.goals || []), newG]
    }));
    setNewGoalTitle('');
    setNewGoalWeight(15);
    setNewGoalCode('');
  };

  const handleRemoveGoal = (gId: string) => {
    setPlanFormData((prev) => ({
      ...prev,
      goals: (prev.goals || []).filter((g) => g.id !== gId)
    }));
  };

  // Handlers for Initiative
  const handleNewInitiative = () => {
    setSelectedInitiativeId(null);
    const defaultPlan = plans[0];
    const defaultGoal = defaultPlan && defaultPlan.goals[0] ? defaultPlan.goals[0].id : '';

    setInitFormData({
      title: '',
      titleEn: '',
      code: `INIT-${new Date().getFullYear()}-${String(initiatives.length + 1).padStart(3, '0')}`,
      domains: ['التمويل التنموي', 'التحول الرقمي'],
      domainsEn: ['Development Funding', 'Digital Transformation'],
      planId: defaultPlan ? defaultPlan.id : 1,
      departmentId: departments[0] ? departments[0].id : 1,
      section: 'قسم التخطيط الاستراتيجي',
      sectionEn: 'Strategic Planning Section',
      planType: defaultPlan ? defaultPlan.planType : (lang === 'ar' ? 'خطة خمسية استراتيجية' : 'Strategic 5-Year Plan'),
      indicator: '',
      indicatorEn: '',
      goalId: defaultGoal,
      organizationUnit: 'الصندوق الثقافي',
      organizationUnitEn: 'Cultural Development Fund',
      cycle: defaultPlan ? defaultPlan.cycle : '2026 - 2030',
      years: ['2026', '2027'],
      startDate: '2026-02-01',
      endDate: '2027-12-31',
      status: 'Draft'
    });
    setViewMode('form');
  };

  const handleSaveInitiative = async () => {
    if ((!initFormData.title && !initFormData.titleEn) || !initFormData.planId) {
      showBanner('error', lang === 'ar' ? 'يرجى إدخال اسم المبادرة والخطة المرتبطة' : 'Please enter title and plan');
      return;
    }

    const payload = {
      ...initFormData,
      title: initFormData.title || initFormData.titleEn || '',
      titleEn: initFormData.titleEn || initFormData.title || ''
    };

    try {
      if (selectedInitiativeId) {
        const res = await apiFetch(`/api/strategic-planning/initiatives/${selectedInitiativeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showBanner('success', lang === 'ar' ? 'تم حفظ المبادرة بنجاح' : 'Initiative saved successfully');
          fetchData();
        }
      } else {
        const res = await apiFetch('/api/strategic-planning/initiatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setSelectedInitiativeId(created.id);
          showBanner('success', lang === 'ar' ? 'تم إنشاء المبادرة بنجاح' : 'Initiative created successfully');
          fetchData();
        }
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'حدث خطأ أثناء حفظ المبادرة' : 'Error saving initiative');
    }
  };

  const handleDuplicateInitiative = async (id: number) => {
    try {
      const res = await apiFetch(`/api/strategic-planning/initiatives/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const created = await res.json();
        showBanner('success', lang === 'ar' ? 'تم نسخ المبادرة بنجاح' : 'Initiative duplicated successfully');
        await fetchData();
        setSelectedInitiativeId(created.id);
        setActiveTab('initiatives');
        setViewMode('form');
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'فشل نسخ المبادرة' : 'Failed to duplicate initiative');
    }
  };

  const handleApproveInitiative = async (id: number) => {
    try {
      const res = await apiFetch(`/api/strategic-planning/initiatives/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        showBanner('success', lang === 'ar' ? 'تم تعميد المبادرة بنجاح ونقلها إلى حالة مقبول' : 'Initiative approved successfully');
        await fetchData();
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'فشل تعميد المبادرة' : 'Failed to approve initiative');
    }
  };

  // Handlers for Activity
  const handleNewActivity = () => {
    setSelectedActivityId(null);
    const defaultInit = initiatives[0];
    setActFormData({
      name: '',
      nameEn: '',
      source: 'أساس',
      sourceEn: 'Base System',
      domains: ['الصناعات الإبداعية', 'التحول الرقمي'],
      domainsEn: ['Creative Industries', 'Digital Transformation'],
      indicator: '',
      indicatorEn: '',
      initiativeId: defaultInit ? defaultInit.id : 1,
      departmentId: defaultInit ? defaultInit.departmentId : 1,
      section: 'قسم التخطيط والمتابعة',
      sectionEn: 'Planning & Follow-up Section',
      startDate: '2026-03-01',
      endDate: '2026-08-31',
      targetValue: 100,
      activityValue: 350000.0,
      isDevelopmentalProject: true,
      isExecutiveBodyActivity: true,
      status: 'Draft',
      chatter: []
    });
    setViewMode('form');
  };

  const handleSaveActivity = async () => {
    if ((!actFormData.name && !actFormData.nameEn) || !actFormData.initiativeId) {
      showBanner('error', lang === 'ar' ? 'يرجى إدخال اسم النشاط والبرنامج المرتبط' : 'Please enter activity name and initiative');
      return;
    }

    const payload = {
      ...actFormData,
      name: actFormData.name || actFormData.nameEn || '',
      nameEn: actFormData.nameEn || actFormData.name || ''
    };

    try {
      if (selectedActivityId) {
        const res = await apiFetch(`/api/strategic-planning/activities/${selectedActivityId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showBanner('success', lang === 'ar' ? 'تم حفظ النشاط بنجاح' : 'Activity saved successfully');
          fetchData();
        }
      } else {
        const res = await apiFetch('/api/strategic-planning/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            authorName: resolvedUserName,
            authorRole: currentUserRole
          })
        });
        if (res.ok) {
          const created = await res.json();
          setSelectedActivityId(created.id);
          showBanner('success', lang === 'ar' ? 'تم إنشاء النشاط بنجاح' : 'Activity created successfully');
          fetchData();
        }
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'حدث خطأ أثناء حفظ النشاط' : 'Error saving activity');
    }
  };

  const handleDuplicateActivity = async (id: number) => {
    try {
      const res = await apiFetch(`/api/strategic-planning/activities/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const created = await res.json();
        showBanner('success', lang === 'ar' ? 'تم نسخ النشاط بنجاح' : 'Activity duplicated successfully');
        await fetchData();
        setSelectedActivityId(created.id);
        setActiveTab('activities');
        setViewMode('form');
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'فشل نسخ النشاط' : 'Failed to duplicate activity');
    }
  };

  const handleApproveActivity = async (id: number) => {
    try {
      const res = await apiFetch(`/api/strategic-planning/activities/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: `${resolvedUserName} (${translateRole(currentUserRole, lang)})` })
      });
      if (res.ok) {
        showBanner('success', lang === 'ar' ? 'تم تعميد النشاط بنجاح ونقله إلى حالة مقبول' : 'Activity approved successfully');
        await fetchData();
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'فشل تعميد النشاط' : 'Failed to approve activity');
    }
  };

  // Add chatter message / note
  const handlePostChatter = async () => {
    if (!selectedActivityId || !chatterText.trim()) return;

    try {
      const res = await apiFetch(`/api/strategic-planning/activities/${selectedActivityId}/chatter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: chatterType,
          author: resolvedUserName,
          authorRole: currentUserRole,
          content: chatterText.trim()
        })
      });
      if (res.ok) {
        const newMsg: ChatterMessage = await res.json();
        setActFormData((prev) => ({
          ...prev,
          chatter: [newMsg, ...(prev.chatter || [])]
        }));
        setChatterText('');
        showBanner('success', lang === 'ar' ? 'تم نشر الرسالة في سجل التواصل' : 'Message posted to chatter');
      }
    } catch {
      showBanner('error', lang === 'ar' ? 'فشل إضافة الرسالة' : 'Failed to post message');
    }
  };

  // Active plan for relational goals filtering in Initiative Form
  const selectedPlanForInit = plans.find((p) => p.id === Number(initFormData.planId));
  const availableGoalsForInit = selectedPlanForInit ? selectedPlanForInit.goals : [];

  // Active initiative for Activity Form
  const selectedInitForAct = initiatives.find((i) => i.id === Number(actFormData.initiativeId));

  // Current entity for smart stat calculation
  const currentPlan = plans.find((p) => p.id === selectedPlanId);
  const planInitiatives = currentPlan ? initiatives.filter((i) => i.planId === currentPlan.id) : [];

  const currentInitiative = initiatives.find((i) => i.id === selectedInitiativeId);
  const initiativeActivities = currentInitiative ? activities.filter((a) => a.initiativeId === currentInitiative.id) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ==================== MODULE TOP BANNER & MAIN TABS ==================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                {lang === 'ar' ? 'التخطيط الاستراتيجي' : 'Strategic Planning'}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {lang === 'ar' ? 'النسخة المؤسسية المعتمدة' : 'Enterprise Certified'}
              </span>
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 mt-1">
              {t.strategicPlanningModule}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.strategicPlanningSubtitle}
            </p>
          </div>
        </div>

        {/* 3 Entity Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('plans');
              setViewMode('list');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t.strategicPlans}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {plans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('initiatives');
              setViewMode('list');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'initiatives'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.strategicInitiativesTab}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {initiatives.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('activities');
              setViewMode('list');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{t.strategicActivitiesTab}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
              {activities.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ENTITY: STRATEGIC PLAN (الخطط الاستراتيجية)                             */}
      {/* ========================================================================= */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          {viewMode === 'list' ? (
            /* Strategic Plans List View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {lang === 'ar' ? 'سجل الخطط الاستراتيجية' : 'Strategic Plans Registry'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'ar' ? 'عرض واعتماد الخطط الخمسية والمؤسسية والمناظير والأهداف المرتبطة بها' : 'Master list of approved and draft strategic plans'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNewPlan}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'خطة استراتيجية جديدة' : 'New Strategic Plan'}</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {plans.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    {t.noRecordsFound}
                  </div>
                ) : (
                  plans.map((p) => {
                    const linkedInits = initiatives.filter((i) => i.planId === p.id);
                    return (
                      <div
                        key={p.id}
                        className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              #{p.id}
                            </span>
                            <h3 className="font-display font-bold text-base text-slate-900">
                              {pickLocalized(lang, p.titleEn, p.titleAr)}
                            </h3>
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                p.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {p.status === 'Approved' ? t.workflowApproved : t.workflowDraft}
                            </span>
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {p.cycle}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-2 max-w-4xl">
                            {pickLocalized(lang, p.descriptionEn || p.visionEn, p.description || p.vision)}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                            <span className="flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-blue-600" />
                              <strong className="text-slate-800">{p.perspectives?.length || 0}</strong> {lang === 'ar' ? 'مناظير' : 'Perspectives'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <Flag className="w-3.5 h-3.5 text-indigo-600" />
                              <strong className="text-slate-800">{p.goals?.length || 0}</strong> {lang === 'ar' ? 'أهداف استراتيجية' : 'Goals'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-sky-600" />
                              <strong className="text-slate-800">{linkedInits.length}</strong> {lang === 'ar' ? 'مبادرات وبرامج' : 'Initiatives'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlanId(p.id);
                              setIsPlanEditing(true);
                              setViewMode('form');
                            }}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'عرض وتحرير' : 'View / Edit'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ==================== STRATEGIC PLAN FORM VIEW (الخطة الاستراتيجية) ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* A. Header & Smart Action Buttons */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleNewPlan}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>{lang === 'ar' ? 'جديد' : 'New'}</span>
                  </button>

                  {isPlanEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSavePlan}
                        disabled={isSavingPlan}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {isSavingPlan
                            ? lang === 'ar'
                              ? 'جارٍ الحفظ...'
                              : 'Saving...'
                            : lang === 'ar'
                            ? 'حفظ'
                            : 'Save'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        disabled={isSavingPlan}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-rose-600 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsPlanEditing(true)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{lang === 'ar' ? 'العودة للخطط' : 'Back to Plans'}</span>
                      </button>

                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 px-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'تم الحفظ' : 'Saved'}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Smart Stat Buttons (Top Ribbon) */}
                <div className="flex items-center gap-2 overflow-x-auto">
                  {/* Initiatives Smart Stat */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('initiatives');
                      setViewMode('list');
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-blue-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 transition-all shadow-2xs flex items-center gap-2 cursor-pointer group"
                    title={lang === 'ar' ? 'عرض المبادرات المرتبطة بهذه الخطة' : 'View linked initiatives'}
                  >
                    <Layers className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                    <div className="text-start">
                      <div className="text-[10px] text-slate-500 font-medium leading-none">
                        {lang === 'ar' ? 'المبادرات' : 'Initiatives'}
                      </div>
                      <div className="font-bold text-xs font-mono text-blue-700 mt-0.5">
                        {planInitiatives.length} {lang === 'ar' ? 'مبادرة' : 'Initiatives'}
                      </div>
                    </div>
                  </button>

                  {/* Perspectives Report Smart Stat */}
                  <button
                    type="button"
                    onClick={() => setPerspectivesReportOpen(true)}
                    className="px-3.5 py-2 bg-white hover:bg-indigo-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 transition-all shadow-2xs flex items-center gap-2 cursor-pointer group"
                  >
                    <BarChart2 className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                    <div className="text-start">
                      <div className="text-[10px] text-slate-500 font-medium leading-none">
                        {lang === 'ar' ? 'تقرير المناظير' : 'Perspectives Report'}
                      </div>
                      <div className="font-bold text-xs font-mono text-indigo-700 mt-0.5">
                        {(planFormData.perspectives || []).length} {lang === 'ar' ? 'مناظير' : 'Perspectives'}
                      </div>
                    </div>
                  </button>

                  {/* Goals Report Smart Stat */}
                  <button
                    type="button"
                    onClick={() => setGoalsReportOpen(true)}
                    className="px-3.5 py-2 bg-white hover:bg-emerald-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 transition-all shadow-2xs flex items-center gap-2 cursor-pointer group"
                  >
                    <ListOrdered className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <div className="text-start">
                      <div className="text-[10px] text-slate-500 font-medium leading-none">
                        {lang === 'ar' ? 'تقرير الأهداف' : 'Goals Report'}
                      </div>
                      <div className="font-bold text-xs font-mono text-emerald-700 mt-0.5">
                        {(planFormData.goals || []).length} {lang === 'ar' ? 'أهداف' : 'Goals'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* B. Main Form Fields */}
              <div className="p-6 space-y-6">
                <fieldset disabled={!isPlanEditing} className="space-y-6 border-0 p-0 m-0 disabled:opacity-90">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* اسم الخطة الاستراتيجية (Title AR) */}
                  {isVisible('strategic-plans', 'titleAr') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'titleAr', 'اسم الخطة الاستراتيجية', 'Strategic Plan Title')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={planFormData.titleAr || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, titleAr: e.target.value })}
                        required
                        placeholder={lang === 'ar' ? "مثال: الخطة الاستراتيجية للتحول الثقافي والمؤسسي (2026 - 2030)" : "e.g. Strategic Plan for Cultural & Institutional Transformation (2026 - 2030)"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                      />
                    </div>
                  )}

                  {/* Strategic Plan Title (English) */}
                  {isVisible('strategic-plans', 'titleEn') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'titleEn', 'اسم الخطة بالإنجليزية', 'Secondary Title (English)')} <span className="text-slate-400 font-normal">{lang === 'ar' ? '(متعدد اللغات)' : '(Multi-language)'}</span>
                      </label>
                      <input
                        type="text"
                        value={planFormData.titleEn || ''}
                        onChange={(e) => setPlanFormData({ ...planFormData, titleEn: e.target.value })}
                        placeholder={lang === 'ar' ? "مثال بالإنجليزية: Strategic Plan for Cultural Transformation" : "e.g. Strategic Plan for Cultural & Institutional Transformation"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* الدورة (Cycle/Period) */}
                  {isVisible('strategic-plans', 'cycle') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'cycle', 'الدورة', 'Cycle')}
                      </label>
                      <select
                        value={planFormData.cycle || '2026 - 2030'}
                        onChange={(e) => setPlanFormData({ ...planFormData, cycle: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                      >
                        {getFieldOptions('strategic-plans', 'cycle', ['2026 - 2030', '2024 - 2028', '2021 - 2025', '2026 - 2028']).map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* السنوات (Years Range) */}
                  {isVisible('strategic-plans', 'yearsRange') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'yearsRange', 'السنوات', 'Years Range')}
                      </label>
                      <input
                        type="text"
                        value={(planFormData.yearsRange || []).join(', ')}
                        onChange={(e) =>
                          setPlanFormData({
                            ...planFormData,
                            yearsRange: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                          })
                        }
                        placeholder="2026, 2027, 2028, 2029, 2030"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors font-mono"
                      />
                    </div>
                  )}

                  {/* نوع الخطة (Plan Type) */}
                  {isVisible('strategic-plans', 'planType') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'planType', 'نوع الخطة', 'Plan Type')} <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={planFormData.planType || (lang === 'ar' ? 'خطة خمسية استراتيجية' : 'Strategic 5-Year Plan')}
                        onChange={(e) => setPlanFormData({ ...planFormData, planType: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                      >
                        {getFieldOptions('strategic-plans', 'planType', [
                          lang === 'ar' ? 'خطة خمسية استراتيجية' : 'Strategic 5-Year Plan',
                          lang === 'ar' ? 'خطة تحول رقمي' : 'Digital Transformation Plan',
                          lang === 'ar' ? 'خطة استدامة مالية واستثمار' : 'Financial Sustainability Plan',
                          lang === 'ar' ? 'خطة تشغيلية استراتيجية' : 'Operational Strategic Plan'
                        ]).map((pt, i) => (
                          <option key={i} value={pt}>{translateOptionLabel(pt, lang)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الرؤية (Vision) */}
                  {isVisible('strategic-plans', 'vision') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'vision', 'الرؤية', 'Vision')}
                      </label>
                      <textarea
                        rows={2}
                        value={lang === 'ar' ? (planFormData.vision || '') : (planFormData.visionEn ?? '')}
                        onChange={(e) =>
                          setPlanFormData(
                            lang === 'ar'
                              ? { ...planFormData, vision: e.target.value }
                              : { ...planFormData, visionEn: e.target.value, vision: planFormData.vision || e.target.value }
                          )
                        }
                        placeholder={lang === 'ar' ? "صياغة الرؤية المستقبلية للمؤسسة..." : "Organizational future vision..."}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors leading-relaxed"
                      />
                    </div>
                  )}

                  {/* الرسالة (Mission) */}
                  {isVisible('strategic-plans', 'mission') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'mission', 'الرسالة', 'Mission')}
                      </label>
                      <textarea
                        rows={2}
                        value={lang === 'ar' ? (planFormData.mission || '') : (planFormData.missionEn ?? '')}
                        onChange={(e) =>
                          setPlanFormData(
                            lang === 'ar'
                              ? { ...planFormData, mission: e.target.value }
                              : { ...planFormData, missionEn: e.target.value, mission: planFormData.mission || e.target.value }
                          )
                        }
                        placeholder={lang === 'ar' ? "صياغة الرسالة والأهداف الجوهرية..." : "Mission statement and core strategic pillars..."}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors leading-relaxed"
                      />
                    </div>
                  )}
                </div>

                {/* الوصف (Description) */}
                {isVisible('strategic-plans', 'description') && (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {getLabel('strategic-plans', 'description', 'الوصف', 'Description')}
                    </label>
                    <textarea
                      rows={2}
                      value={lang === 'ar' ? (planFormData.description || '') : (planFormData.descriptionEn ?? '')}
                      onChange={(e) =>
                        setPlanFormData(
                          lang === 'ar'
                            ? { ...planFormData, description: e.target.value }
                            : { ...planFormData, descriptionEn: e.target.value, description: planFormData.description || e.target.value }
                        )
                      }
                      placeholder={lang === 'ar' ? "وصف تفصيلي للخطة الاستراتيجية وأطر تطبيقها..." : "Detailed description of the strategic plan..."}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors leading-relaxed"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* القضايا الاستراتيجية (Strategic Issues) */}
                  {isVisible('strategic-plans', 'strategicIssues') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'strategicIssues', 'القضايا الاستراتيجية', 'Strategic Issues')} <span className="text-slate-400 font-normal">{lang === 'ar' ? '(مفصولة بفواصل)' : '(comma separated)'}</span>
                      </label>
                      <input
                        type="text"
                        value={(lang === 'ar' ? (planFormData.strategicIssues || []) : (planFormData.strategicIssuesEn || [])).join(lang === 'ar' ? ' ، ' : ', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
                          setPlanFormData(
                            lang === 'ar'
                              ? { ...planFormData, strategicIssues: arr }
                              : { ...planFormData, strategicIssuesEn: arr }
                          );
                        }}
                        placeholder={lang === 'ar' ? "الاستدامة المالية، التحول الرقمي، تنمية رأس المال البشري" : "Financial Sustainability, Digital Transformation, Human Capital"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                      />
                    </div>
                  )}

                  {/* القيم (Values) */}
                  {isVisible('strategic-plans', 'values') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-plans', 'values', 'القيم', 'Values')} <span className="text-slate-400 font-normal">{lang === 'ar' ? '(مفصولة بفواصل)' : '(comma separated)'}</span>
                      </label>
                      <input
                        type="text"
                        value={(lang === 'ar' ? (planFormData.values || []) : (planFormData.valuesEn || [])).join(lang === 'ar' ? ' ، ' : ', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
                          setPlanFormData(
                            lang === 'ar'
                              ? { ...planFormData, values: arr }
                              : { ...planFormData, valuesEn: arr }
                          );
                        }}
                        placeholder={lang === 'ar' ? "الشفافية، الابتكار، التميز المؤسسي، التعاون" : "Transparency, Innovation, Institutional Excellence, Collaboration"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Dynamic Custom Fields configured by Admin */}
                {getCustomFields('strategic-plans').length > 0 && (
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        {lang === 'ar' ? 'حقول إضافية مخصصة (تم تكوينها بواسطة مدير النظام)' : 'Dynamic Custom Fields (Admin Studio)'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getCustomFields('strategic-plans').map((cf) => (
                        <div key={cf.key}>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            {lang === 'ar' ? cf.labelAr : cf.labelEn}
                            {cf.required && <span className="text-rose-500 ms-1">*</span>}
                          </label>
                          {cf.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              value={planFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setPlanFormData({
                                  ...planFormData,
                                  customFields: {
                                    ...(planFormData.customFields || {}),
                                    [cf.key]: e.target.value
                                  }
                                })
                              }
                              placeholder={lang === 'en' ? (cf.placeholderEn || cf.placeholder || '') : (cf.placeholder || '')}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            />
                          ) : cf.type === 'select' ? (
                            <select
                              value={planFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setPlanFormData({
                                  ...planFormData,
                                  customFields: {
                                    ...(planFormData.customFields || {}),
                                    [cf.key]: e.target.value
                                  }
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            >
                              <option value="">{lang === 'ar' ? '-- اختر خياراً --' : '-- Select --'}</option>
                              {(cf.options || []).map((opt, idx) => (
                                <option key={opt} value={opt}>
                                  {lang === 'en' && cf.optionsEn?.[idx] ? cf.optionsEn[idx] : translateOptionLabel(opt, lang)}
                                </option>
                              ))}
                            </select>
                          ) : cf.type === 'boolean' ? (
                            <label className="flex items-center gap-2 pt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(planFormData.customFields?.[cf.key])}
                                onChange={(e) =>
                                  setPlanFormData({
                                    ...planFormData,
                                    customFields: {
                                      ...(planFormData.customFields || {}),
                                      [cf.key]: e.target.checked
                                    }
                                  })
                                }
                                className="w-4 h-4 rounded text-indigo-600"
                              />
                              <span className="text-xs text-slate-700">{lang === 'ar' ? 'تفعيل' : 'Enabled'}</span>
                            </label>
                          ) : (
                            <input
                              type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                              value={planFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setPlanFormData({
                                  ...planFormData,
                                  customFields: {
                                    ...(planFormData.customFields || {}),
                                    [cf.key]: cf.type === 'number' ? Number(e.target.value) : e.target.value
                                  }
                                })
                              }
                              placeholder={lang === 'en' ? (cf.placeholderEn || cf.placeholder || '') : (cf.placeholder || '')}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </fieldset>

                {/* C. Sub-Tabs & Data Grids */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
                    <button
                      type="button"
                      onClick={() => setPlanSubTab('perspectives')}
                      className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                        planSubTab === 'perspectives'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'التبويب 1: المناظير' : 'Tab 1: Perspectives'}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700">
                        {(planFormData.perspectives || []).length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlanSubTab('goals')}
                      className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                        planSubTab === 'goals'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'التبويب 2: الأهداف الاستراتيجية' : 'Tab 2: Strategic Goals'}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700">
                        {(planFormData.goals || []).length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPlanSubTab('seminarCard')}
                      className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                        planSubTab === 'seminarCard'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'التبويب 3: بطاقة الندوة' : 'Tab 3: Seminar Card'}</span>
                    </button>
                  </div>

                  {/* Tab 1 Content: المناظير */}
                  {planSubTab === 'perspectives' && (
                    <div className="space-y-4">
                      {/* Grid Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-start border-collapse text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <tr>
                              <th className="py-2.5 px-4 text-start">{lang === 'ar' ? 'المنظور' : 'Perspective Name'}</th>
                              <th className="py-2.5 px-4 text-start w-40">{lang === 'ar' ? 'وزن المنظور (%)' : 'Perspective Weight (%)'}</th>
                              <th className="py-2.5 px-4 text-end w-20">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(planFormData.perspectives || []).length === 0 ? (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-slate-400">
                                  {lang === 'ar' ? 'لا توجد مناظير مضافة بعد. استخدم النموذج أدناه لإضافة بند.' : 'No perspectives added yet. Use the form below to add a row.'}
                                </td>
                              </tr>
                            ) : (
                              (planFormData.perspectives || []).map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/60">
                                  <td className="py-2.5 px-4 font-semibold text-slate-800">{pickLocalized(lang, p.nameEn, p.name)}</td>
                                  <td className="py-2.5 px-4 font-mono font-bold text-blue-600">{p.weight}%</td>
                                  <td className="py-2.5 px-4 text-end">
                                    {isPlanEditing && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePerspective(p.id)}
                                        className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* إضافة بند (Add Row) */}
                      {isPlanEditing && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                          <input
                            type="text"
                            value={newPerspName}
                            onChange={(e) => setNewPerspName(e.target.value)}
                            placeholder={lang === 'ar' ? 'اسم المنظور الجديد...' : 'New perspective name...'}
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 font-medium">{lang === 'ar' ? 'الوزن:' : 'Weight:'}</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={newPerspWeight}
                              onChange={(e) => setNewPerspWeight(Number(e.target.value))}
                              className="w-20 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-center focus:outline-none focus:border-blue-600"
                            />
                            <span className="text-xs font-bold text-slate-600">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddPerspective}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'إضافة بند' : 'Add Row'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2 Content: الأهداف (Strategic Goals) */}
                  {planSubTab === 'goals' && (
                    <div className="space-y-4">
                      {/* Grid Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-start border-collapse text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <tr>
                              <th className="py-2.5 px-4 text-start w-52">{lang === 'ar' ? 'المنظور المرتبط' : 'Linked Perspective'}</th>
                              <th className="py-2.5 px-4 text-start">{lang === 'ar' ? 'عنوان الهدف' : 'Goal Title'}</th>
                              <th className="py-2.5 px-4 text-start w-32">{lang === 'ar' ? 'وزن الهدف (%)' : 'Goal Weight (%)'}</th>
                              <th className="py-2.5 px-4 text-end w-20">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(planFormData.goals || []).length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-slate-400">
                                  {lang === 'ar' ? 'لا توجد أهداف استراتيجية مضافة. استخدم النموذج أدناه لإضافة هدف وربطه بمنظور.' : 'No strategic goals added yet. Use the form below to add a goal.'}
                                </td>
                              </tr>
                            ) : (
                              (planFormData.goals || []).map((g) => {
                                const persp = (planFormData.perspectives || []).find((p) => p.id === g.perspectiveId);
                                return (
                                  <tr key={g.id} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-4 text-slate-600 font-medium">
                                      {persp
                                        ? pickLocalized(lang, persp.nameEn, persp.name)
                                        : pickLocalized(lang, g.perspectiveNameEn, g.perspectiveName, '—')}
                                    </td>
                                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                                      <div className="flex items-center gap-2">
                                        {g.code && (
                                          <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                            {g.code}
                                          </span>
                                        )}
                                        <span>{pickLocalized(lang, g.titleEn, g.title)}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-600">{g.weight}%</td>
                                    <td className="py-2.5 px-4 text-end">
                                      {isPlanEditing && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveGoal(g.id)}
                                          className="text-rose-500 hover:text-rose-700 cursor-pointer p-1"
                                          title={lang === 'ar' ? 'حذف' : 'Delete'}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* إضافة بند (Add Goal Row) */}
                      {isPlanEditing && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-center gap-3">
                          <select
                            value={newGoalPerspId}
                            onChange={(e) => setNewGoalPerspId(e.target.value)}
                            className="w-full md:w-56 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                          >
                            <option value="">{lang === 'ar' ? 'اختر المنظور المرتبط...' : 'Select linked perspective...'}</option>
                            {(planFormData.perspectives || []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {pickLocalized(lang, p.nameEn, p.name)}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={newGoalTitle}
                            onChange={(e) => setNewGoalTitle(e.target.value)}
                            placeholder={lang === 'ar' ? 'عنوان الهدف الاستراتيجي...' : 'Strategic goal title...'}
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600"
                          />

                          <input
                            type="text"
                            value={newGoalCode}
                            onChange={(e) => setNewGoalCode(e.target.value)}
                            placeholder={lang === 'ar' ? 'رمز الهدف - اختياري' : 'Goal Code - optional'}
                            className="w-28 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-600"
                          />

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-slate-600 font-medium">{lang === 'ar' ? 'الوزن:' : 'Weight:'}</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={newGoalWeight}
                              onChange={(e) => setNewGoalWeight(Number(e.target.value))}
                              className="w-16 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-center focus:outline-none focus:border-blue-600"
                            />
                            <span className="text-xs font-bold text-slate-600">%</span>
                          </div>

                          <button
                            type="button"
                            onClick={handleAddGoal}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'إضافة بند' : 'Add Row'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3 Content: بطاقة الندوة (Seminar Details) */}
                  {planSubTab === 'seminarCard' && (
                    <fieldset disabled={!isPlanEditing} className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 space-y-4 disabled:opacity-90">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'الجهة المنظمة / الراعية' : 'Host / Sponsoring Entity'}
                          </label>
                          <input
                            type="text"
                            value={lang === 'ar' ? (planFormData.seminarCard?.organizer || '') : (planFormData.seminarCard?.organizerEn ?? '')}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: {
                                  ...planFormData.seminarCard,
                                  ...(lang === 'ar' ? { organizer: e.target.value } : { organizerEn: e.target.value })
                                }
                              })
                            }
                            placeholder={lang === 'ar' ? 'الإدارة العامة للاستراتيجية والتميز المؤسسي' : 'Strategy & Institutional Excellence Sector'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'المقر / القاعة' : 'Location / Venue'}
                          </label>
                          <input
                            type="text"
                            value={lang === 'ar' ? (planFormData.seminarCard?.venue || '') : (planFormData.seminarCard?.venueEn ?? '')}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: {
                                  ...planFormData.seminarCard,
                                  ...(lang === 'ar' ? { venue: e.target.value } : { venueEn: e.target.value })
                                }
                              })
                            }
                            placeholder={lang === 'ar' ? 'قاعة المؤتمرات الكبرى - المقر الرئيسي' : 'Main Conference Hall - Headquarters'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'تاريخ الجلسة / التدشين' : 'Session / Launch Date'}
                          </label>
                          <input
                            type="date"
                            value={planFormData.seminarCard?.sessionDate || ''}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: { ...planFormData.seminarCard, sessionDate: e.target.value }
                              })
                            }
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'الملخص التنفيذي للجلسة' : 'Session Executive Summary'}
                          </label>
                          <textarea
                            rows={3}
                            value={lang === 'ar' ? (planFormData.seminarCard?.executiveSummary || '') : (planFormData.seminarCard?.executiveSummaryEn ?? '')}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: {
                                  ...planFormData.seminarCard,
                                  ...(lang === 'ar' ? { executiveSummary: e.target.value } : { executiveSummaryEn: e.target.value })
                                }
                              })
                            }
                            placeholder={lang === 'ar' ? 'خلاصة توصيات ندوة إعداد واعتماد الخطة الاستراتيجية...' : 'Summary recommendations from the strategic formulation seminar...'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'أصحاب المصلحة والشركاء الرئيسيون' : 'Key Stakeholders & Partners'}
                          </label>
                          <textarea
                            rows={3}
                            value={lang === 'ar' ? (planFormData.seminarCard?.keyStakeholders || '') : (planFormData.seminarCard?.keyStakeholdersEn ?? '')}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: {
                                  ...planFormData.seminarCard,
                                  ...(lang === 'ar' ? { keyStakeholders: e.target.value } : { keyStakeholdersEn: e.target.value })
                                }
                              })
                            }
                            placeholder={lang === 'ar' ? 'وزارة الثقافة، هيئة الترفيه، البنوك الشريكة، مجتمع رواد الأعمال...' : 'Ministry of Culture, partner banks, entrepreneurial ecosystem...'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'إطار قياس الأداء' : 'KPI Framework'}
                          </label>
                          <input
                            type="text"
                            value={lang === 'ar' ? (planFormData.seminarCard?.kpiFramework || '') : (planFormData.seminarCard?.kpiFrameworkEn ?? '')}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: {
                                  ...planFormData.seminarCard,
                                  ...(lang === 'ar' ? { kpiFramework: e.target.value } : { kpiFrameworkEn: e.target.value })
                                }
                              })
                            }
                            placeholder={lang === 'ar' ? 'بطاقة الأداء المتوازن' : 'Balanced Scorecard'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {lang === 'ar' ? 'ملاحظات واعتمادات الميزانية' : 'Budget Allocations & Notes'}
                          </label>
                          <input
                            type="text"
                            value={lang === 'ar' ? (planFormData.seminarCard?.budgetNotes || '') : (planFormData.seminarCard?.budgetNotesEn ?? '')}
                            onChange={(e) =>
                              setPlanFormData({
                                ...planFormData,
                                seminarCard: {
                                  ...planFormData.seminarCard,
                                  ...(lang === 'ar' ? { budgetNotes: e.target.value } : { budgetNotesEn: e.target.value })
                                }
                              })
                            }
                            placeholder={lang === 'ar' ? 'مخصصات الميزانية الأولية والجهات المانحة المعتمدة...' : 'Initial budget allocations and donor funding approvals...'}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ENTITY: INITIATIVES & PROGRAMS (المبادرات والبرامج)                      */}
      {/* ========================================================================= */}
      {activeTab === 'initiatives' && (
        <div className="space-y-6">
          {viewMode === 'list' ? (
            /* Initiatives List View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {lang === 'ar' ? 'سجل المبادرات والبرامج الاستراتيجية' : 'Strategic Initiatives & Programs'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'ar' ? 'ربط المبادرات بالخطط الاستراتيجية والأهداف المعتمدة وإدارة مسارات التعميد' : 'Programs and initiatives linked to strategic goals with approval workflow'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNewInitiative}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'مبادرة جديدة' : 'New Initiative'}</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {initiatives.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    {t.noRecordsFound}
                  </div>
                ) : (
                  initiatives.map((init) => {
                    const linkedActs = activities.filter((a) => a.initiativeId === init.id);
                    const totalBudget = linkedActs.reduce((acc, a) => acc + (Number(a.activityValue) || 0), 0);

                    return (
                      <div
                        key={init.id}
                        className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              {init.code || `#${init.id}`}
                            </span>
                            <h3 className="font-display font-bold text-base text-slate-900">
                              {pickLocalized(lang, init.titleEn, init.title)}
                            </h3>
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                init.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {init.status === 'Approved' ? t.workflowApproved : t.workflowDraft}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                            <span className="font-medium text-blue-700">
                              {lang === 'ar' ? 'الخطة:' : 'Plan:'} {pickLocalized(lang, init.planTitleEn, init.planTitle, lang === 'ar' ? 'الخطة الاستراتيجية المؤسسية' : 'Institutional Strategic Plan')}
                            </span>
                            <span>•</span>
                            <span className="text-slate-700">
                              {lang === 'ar' ? 'الهدف:' : 'Goal:'} {pickLocalized(lang, init.goalTitleEn, init.goalTitle, lang === 'ar' ? 'الهدف الاستراتيجي' : 'Strategic Goal')}
                            </span>
                            <span>•</span>
                            <span className="text-slate-500">
                              {lang === 'ar' ? 'الإدارة:' : 'Department:'} {pickLocalized(lang, init.departmentNameEn || init.departmentName, init.departmentNameAr || init.departmentName, lang === 'ar' ? 'إدارة التخطيط' : 'Planning Department')}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                            <span className="flex items-center gap-1.5 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {init.startDate} ➔ {init.endDate}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5 font-mono text-emerald-700 font-bold">
                              <DollarSign className="w-3.5 h-3.5" />
                              {totalBudget.toLocaleString()} {lang === 'ar' ? 'ريال' : 'SAR'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                              <strong className="text-slate-800">{linkedActs.length}</strong> {lang === 'ar' ? 'أنشطة مرتبطة' : 'linked activities'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {init.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => handleApproveInitiative(init.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title={lang === 'ar' ? 'تعميد المبادرة ونقلها إلى مقبول' : 'Validate and approve initiative'}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تعميد' : 'Approve'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDuplicateInitiative(init.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                            title={lang === 'ar' ? 'نسخ المبادرة' : 'Duplicate initiative'}
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>{lang === 'ar' ? 'نسخ' : 'Duplicate'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInitiativeId(init.id);
                              setViewMode('form');
                            }}
                            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'عرض وتحرير' : 'View & Edit'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ==================== INITIATIVE FORM VIEW ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* A. Status Bar & Workflow */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {initFormData.status === 'Draft' ? (
                    <button
                      type="button"
                      onClick={() => selectedInitiativeId && handleApproveInitiative(selectedInitiativeId)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تعميد' : 'Validate & Approve'}</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'معمدة رسمياً' : 'Approved'}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveInitiative}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                  </button>

                  {selectedInitiativeId && (
                    <button
                      type="button"
                      onClick={() => handleDuplicateInitiative(selectedInitiativeId)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{lang === 'ar' ? 'نسخ المبادرة' : 'Duplicate Initiative'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-rose-600 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                  </button>
                </div>

                {/* Workflow Status Bar Pipeline */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 bg-slate-200/80 rounded-xl text-xs font-semibold">
                    <span
                      className={`px-3 py-1 rounded-lg transition-all ${
                        initFormData.status === 'Draft'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {lang === 'ar' ? 'مسودة' : 'Draft'}
                    </span>
                    <span className="text-slate-400 px-1.5">➔</span>
                    <span
                      className={`px-3 py-1 rounded-lg transition-all ${
                        initFormData.status === 'Approved'
                          ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {lang === 'ar' ? 'مقبول' : 'Approved'}
                    </span>
                  </div>

                  {/* Smart Stat Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('activities');
                        setViewMode('list');
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-300 rounded-lg text-xs font-semibold text-blue-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      <span>{initiativeActivities.length} {lang === 'ar' ? 'الأنشطة' : 'Activities'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onNavigateToProjects}
                      className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-300 rounded-lg text-xs font-semibold text-indigo-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title={lang === 'ar' ? 'الانتقال إلى مشاريع مكتب إدارة المشاريع المرتبطة' : 'Navigate to linked PMO projects'}
                    >
                      <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{lang === 'ar' ? 'مشاريع مكتب إدارة المشاريع' : 'PMO Projects'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* B. Main Form Fields */}
              <div className="p-6 space-y-6">
                {/* General Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {isVisible('strategic-initiatives', 'title') && (
                    <div className={isVisible('strategic-initiatives', 'domains') ? 'md:col-span-2' : 'md:col-span-3'}>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-initiatives', 'title', 'إسم المبادرة', 'Initiative Title')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lang === 'ar' ? (initFormData.title || '') : (initFormData.titleEn ?? '')}
                        onChange={(e) =>
                          setInitFormData(
                            lang === 'ar'
                              ? { ...initFormData, title: e.target.value }
                              : { ...initFormData, titleEn: e.target.value, title: initFormData.title || e.target.value }
                          )
                        }
                        required
                        placeholder={lang === 'ar' ? "مثال: برنامج المنح والحوافز للمشاريع الإبداعية الثقافية" : "e.g. Grants and Incentives Program for Creative Projects"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}

                  {isVisible('strategic-initiatives', 'domains') && (
                    <div className={!isVisible('strategic-initiatives', 'title') ? 'md:col-span-3' : ''}>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-initiatives', 'domains', 'المجالات', 'Domains')} <span className="text-slate-400 font-normal">{lang === 'ar' ? '(مفصولة بفواصل)' : '(comma separated)'}</span>
                      </label>
                      <input
                        type="text"
                        value={(lang === 'ar' ? (initFormData.domains || []) : (initFormData.domainsEn || [])).join(lang === 'ar' ? ' ، ' : ', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
                          setInitFormData(
                            lang === 'ar'
                              ? { ...initFormData, domains: arr }
                              : { ...initFormData, domainsEn: arr }
                          );
                        }}
                        placeholder={lang === 'ar' ? "التمويل التنموي، الصناعات الإبداعية، التحول الرقمي" : "Development Funding, Creative Industries, Digital Transformation"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Section: معلومات عامة (General Information) */}
                <div className="pt-2">
                  <div className="pb-2 mb-4 border-b border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>{lang === 'ar' ? 'معلومات عامة' : 'General Information'}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* الخطة الإستراتيجية (Relational Dropdown) */}
                    {isVisible('strategic-initiatives', 'planId') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          {getLabel('strategic-initiatives', 'planId', 'الخطة الإستراتيجية', 'Linked Strategic Plan')} <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={initFormData.planId || ''}
                          onChange={(e) => {
                            const pId = Number(e.target.value);
                            const chosenPlan = plans.find((p) => p.id === pId);
                            setInitFormData({
                              ...initFormData,
                              planId: pId,
                              planType: chosenPlan ? chosenPlan.planType : initFormData.planType,
                              cycle: chosenPlan ? chosenPlan.cycle : initFormData.cycle,
                              goalId: chosenPlan && chosenPlan.goals[0] ? chosenPlan.goals[0].id : ''
                            });
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                        >
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {pickLocalized(lang, p.titleEn, p.titleAr)} ({p.cycle})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* الهدف (Strategic Goal from selected Plan) */}
                    {isVisible('strategic-initiatives', 'goalId') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          {getLabel('strategic-initiatives', 'goalId', 'الهدف', 'Strategic Goal')} <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={initFormData.goalId || ''}
                          onChange={(e) => setInitFormData({ ...initFormData, goalId: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                        >
                          <option value="">{lang === 'ar' ? 'اختر الهدف الاستراتيجي المرتبط...' : 'Select linked strategic goal...'}</option>
                          {availableGoalsForInit.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.code ? `[${g.code}] ` : ''}{pickLocalized(lang, g.titleEn, g.title)} ({pickLocalized(lang, g.perspectiveNameEn, g.perspectiveName, lang === 'ar' ? 'منظور' : 'Perspective')})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* نوع الخطة (Auto-populated / Dropdown) */}
                    {isVisible('strategic-initiatives', 'planType') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          {getLabel('strategic-initiatives', 'planType', 'نوع الخطة', 'Plan Type')}
                        </label>
                        <input
                          type="text"
                          value={translateOptionLabel(initFormData.planType || (lang === 'ar' ? 'خطة خمسية استراتيجية' : 'Strategic 5-Year Plan'), lang)}
                          onChange={(e) => setInitFormData({ ...initFormData, planType: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {/* الإدارة (Department) */}
                    {isVisible('strategic-initiatives', 'departmentId') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          {getLabel('strategic-initiatives', 'departmentId', 'الإدارة', 'Department')}
                        </label>
                        <select
                          value={initFormData.departmentId || 1}
                          onChange={(e) => setInitFormData({ ...initFormData, departmentId: Number(e.target.value) })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {lang === 'ar' ? d.nameAr || d.name : d.nameEn || d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* القسم (Section / Division) */}
                    {isVisible('strategic-initiatives', 'section') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          {getLabel('strategic-initiatives', 'section', 'القسم', 'Section')}
                        </label>
                        <input
                          type="text"
                          value={lang === 'ar' ? (initFormData.section || '') : (initFormData.sectionEn ?? '')}
                          onChange={(e) =>
                            setInitFormData(
                              lang === 'ar'
                                ? { ...initFormData, section: e.target.value }
                                : { ...initFormData, sectionEn: e.target.value }
                            )
                          }
                          placeholder={lang === 'ar' ? "قسم التمويل التنموي" : "Development Funding Section"}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* المنظمة (Organization Unit) */}
                    {isVisible('strategic-initiatives', 'organizationUnit') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          {getLabel('strategic-initiatives', 'organizationUnit', 'المنظمة', 'Organization Unit')}
                        </label>
                        <input
                          type="text"
                          value={translateOptionLabel(lang === 'ar' ? (initFormData.organizationUnit || 'الصندوق الثقافي') : (initFormData.organizationUnitEn || initFormData.organizationUnit || 'Cultural Development Fund'), lang)}
                          onChange={(e) =>
                            setInitFormData(
                              lang === 'ar'
                                ? { ...initFormData, organizationUnit: e.target.value }
                                : { ...initFormData, organizationUnitEn: e.target.value }
                            )
                          }
                          className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                        />
                      </div>
                    )}
                  </div>

                  {/* المؤشر (KPI Indicator) */}
                  {isVisible('strategic-initiatives', 'indicator') && (
                    <div className="mt-4">
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-initiatives', 'indicator', 'المؤشر', 'KPI Indicator')}
                      </label>
                      <input
                        type="text"
                        value={lang === 'ar' ? (initFormData.indicator || '') : (initFormData.indicatorEn ?? '')}
                        onChange={(e) =>
                          setInitFormData(
                            lang === 'ar'
                              ? { ...initFormData, indicator: e.target.value }
                              : { ...initFormData, indicatorEn: e.target.value }
                          )
                        }
                        placeholder={lang === 'ar' ? "مثال: قيمة التمويلات المصروفة للمشاريع المستهدفة (مليون ريال)" : "e.g. Total disbursements for targeted projects (SAR Million)"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Section: المدة الزمنية (Timeframe) */}
                <div className="pt-2">
                  <div className="pb-2 mb-4 border-b border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'ar' ? 'المدة الزمنية' : 'Timeframe'}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* الدورة */}
                    {isVisible('strategic-initiatives', 'cycle') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {getLabel('strategic-initiatives', 'cycle', 'الدورة', 'Cycle')}
                        </label>
                        <input
                          type="text"
                          value={initFormData.cycle || '2026 - 2030'}
                          onChange={(e) => setInitFormData({ ...initFormData, cycle: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    )}

                    {/* السنوات */}
                    {isVisible('strategic-initiatives', 'years') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {getLabel('strategic-initiatives', 'years', 'السنوات', 'Years')}
                        </label>
                        <input
                          type="text"
                          value={(initFormData.years || []).join(', ')}
                          onChange={(e) =>
                            setInitFormData({
                              ...initFormData,
                              years: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            })
                          }
                          placeholder="2026, 2027"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    )}

                    {/* تاريخ البدء */}
                    {isVisible('strategic-initiatives', 'startDate') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {getLabel('strategic-initiatives', 'startDate', 'تاريخ البدء', 'Start Date')}
                        </label>
                        <input
                          type="date"
                          value={initFormData.startDate || ''}
                          onChange={(e) => setInitFormData({ ...initFormData, startDate: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    )}

                    {/* تاريخ الانتهاء */}
                    {isVisible('strategic-initiatives', 'endDate') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          {getLabel('strategic-initiatives', 'endDate', 'تاريخ الانتهاء', 'End Date')}
                        </label>
                        <input
                          type="date"
                          value={initFormData.endDate || ''}
                          onChange={(e) => setInitFormData({ ...initFormData, endDate: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Custom Fields configured by Admin */}
                {getCustomFields('strategic-initiatives').length > 0 && (
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        {lang === 'ar' ? 'حقول إضافية مخصصة للمبادرة (تم تكوينها بواسطة مدير النظام)' : 'Dynamic Custom Fields (Admin Studio)'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getCustomFields('strategic-initiatives').map((cf) => (
                        <div key={cf.key}>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            {lang === 'ar' ? cf.labelAr : cf.labelEn}
                            {cf.required && <span className="text-rose-500 ms-1">*</span>}
                          </label>
                          {cf.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              value={initFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setInitFormData({
                                  ...initFormData,
                                  customFields: {
                                    ...(initFormData.customFields || {}),
                                    [cf.key]: e.target.value
                                  }
                                })
                              }
                              placeholder={lang === 'en' ? (cf.placeholderEn || cf.placeholder || '') : (cf.placeholder || '')}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            />
                          ) : cf.type === 'select' ? (
                            <select
                              value={initFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setInitFormData({
                                  ...initFormData,
                                  customFields: {
                                    ...(initFormData.customFields || {}),
                                    [cf.key]: e.target.value
                                  }
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            >
                              <option value="">{lang === 'ar' ? '-- اختر خياراً --' : '-- Select --'}</option>
                              {(cf.options || []).map((opt, idx) => (
                                <option key={opt} value={opt}>
                                  {lang === 'en' && cf.optionsEn?.[idx] ? cf.optionsEn[idx] : translateOptionLabel(opt, lang)}
                                </option>
                              ))}
                            </select>
                          ) : cf.type === 'boolean' ? (
                            <label className="flex items-center gap-2 pt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(initFormData.customFields?.[cf.key])}
                                onChange={(e) =>
                                  setInitFormData({
                                    ...initFormData,
                                    customFields: {
                                      ...(initFormData.customFields || {}),
                                      [cf.key]: e.target.checked
                                    }
                                  })
                                }
                                className="w-4 h-4 rounded text-indigo-600"
                              />
                              <span className="text-xs text-slate-700">{lang === 'ar' ? 'تفعيل' : 'Enabled'}</span>
                            </label>
                          ) : (
                            <input
                              type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                              value={initFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setInitFormData({
                                  ...initFormData,
                                  customFields: {
                                    ...(initFormData.customFields || {}),
                                    [cf.key]: cf.type === 'number' ? Number(e.target.value) : e.target.value
                                  }
                                })
                              }
                              placeholder={lang === 'en' ? (cf.placeholderEn || cf.placeholder || '') : (cf.placeholder || '')}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Activities Grid Attached to this Initiative */}
                <div className="pt-2">
                  <div className="pb-2 mb-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <span>{lang === 'ar' ? `الأنشطة التنفيذية التابعة للمبادرة (${initiativeActivities.length})` : `Executive Activities for Initiative (${initiativeActivities.length})`}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleNewActivity();
                        if (selectedInitiativeId) {
                          setActFormData((prev) => ({ ...prev, initiativeId: selectedInitiativeId }));
                        }
                        setActiveTab('activities');
                      }}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إضافة نشاط' : 'Add Activity'}</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-start border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                        <tr>
                          <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'النشاط' : 'Activity'}</th>
                          <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'المصدر' : 'Source'}</th>
                          <th className="py-2.5 px-3 text-start font-mono">{lang === 'ar' ? 'الفترة' : 'Period'}</th>
                          <th className="py-2.5 px-3 text-end font-mono">{lang === 'ar' ? 'قيمة النشاط (ريال)' : 'Activity Value (SAR)'}</th>
                          <th className="py-2.5 px-3 text-center">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {initiativeActivities.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400">
                              {lang === 'ar' ? 'لا توجد أنشطة مرتبطة بهذه المبادرة حتى الآن.' : 'No activities linked to this initiative yet.'}
                            </td>
                          </tr>
                        ) : (
                          initiativeActivities.map((act) => (
                            <tr key={act.id} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{pickLocalized(lang, act.nameEn, act.name)}</td>
                              <td className="py-2.5 px-3 text-slate-500">{translateOptionLabel(pickLocalized(lang, act.sourceEn, act.source), lang)}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{act.startDate} ➔ {act.endDate}</td>
                              <td className="py-2.5 px-3 text-end font-mono font-bold text-emerald-700">
                                {Number(act.activityValue).toLocaleString()} {lang === 'ar' ? 'ريال' : 'SAR'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    act.status === 'Approved'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {act.status === 'Approved' ? (lang === 'ar' ? 'مقبول' : 'Approved') : (lang === 'ar' ? 'مسودة' : 'Draft')}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ENTITY: ACTIVITIES (الأنشطة)                                           */}
      {/* ========================================================================= */}
      {activeTab === 'activities' && (
        <div className="space-y-6">
          {viewMode === 'list' ? (
            /* Activities List View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {lang === 'ar' ? 'سجل الأنشطة الاستراتيجية' : 'Strategic Activities Registry'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lang === 'ar' ? 'إدارة الأنشطة التنفيذية ومستهدفات المؤشرات وميزانيات المشاريع وسجل التواصل' : 'Execution activities, target values, budgets, and audit chatter'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNewActivity}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'نشاط جديد' : 'New Activity'}</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {activities.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    {t.noRecordsFound}
                  </div>
                ) : (
                  activities.map((act) => {
                    const init = initiatives.find((i) => i.id === act.initiativeId);
                    return (
                      <div
                        key={act.id}
                        className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              #{act.id}
                            </span>
                            <h3 className="font-display font-bold text-base text-slate-900">
                              {pickLocalized(lang, act.nameEn, act.name)}
                            </h3>
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                act.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {act.status === 'Approved' ? t.workflowApproved : t.workflowDraft}
                            </span>
                            {act.isDevelopmentalProject && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {lang === 'ar' ? 'مشروع تنموي' : 'Developmental Project'}
                              </span>
                            )}
                            {act.isExecutiveBodyActivity && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                {lang === 'ar' ? 'هيئة تنفيذية' : 'Executive Body'}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                            <span className="font-semibold text-blue-700">
                              {lang === 'ar' ? 'البرنامج:' : 'Program:'} {init ? pickLocalized(lang, init.titleEn, init.title) : pickLocalized(lang, act.initiativeTitleEn, act.initiativeTitle, '—')}
                            </span>
                            <span>•</span>
                            <span className="text-slate-500">
                              {lang === 'ar' ? 'المصدر:' : 'Source:'} <strong className="text-slate-800">{translateOptionLabel(pickLocalized(lang, act.sourceEn, act.source), lang)}</strong>
                            </span>
                            <span>•</span>
                            <span className="text-slate-500">
                              {lang === 'ar' ? 'المؤشر:' : 'KPI:'} {pickLocalized(lang, act.indicatorEn, act.indicator, lang === 'ar' ? 'غير محدد' : 'Unspecified')}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1 font-mono">
                            <span className="flex items-center gap-1.5 text-slate-600">
                              <Calendar className="w-3.5 h-3.5" />
                              {act.startDate} ➔ {act.endDate}
                            </span>
                            <span>•</span>
                            <span className="text-slate-700">
                              {lang === 'ar' ? 'مستهدف المؤشر:' : 'Target Value:'} <strong className="text-blue-700">{act.targetValue}</strong>
                            </span>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold">
                              {lang === 'ar' ? `قيمة النشاط: ${Number(act.activityValue).toLocaleString()} ريال` : `Activity Value: ${Number(act.activityValue).toLocaleString()} SAR`}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-sans text-slate-500">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {lang === 'ar' ? `${act.chatter?.length || 0} تدوينات` : `${act.chatter?.length || 0} Notes`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {act.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => handleApproveActivity(act.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title={lang === 'ar' ? 'تعميد النشاط' : 'Approve Activity'}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تعميد' : 'Approve'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDuplicateActivity(act.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>{lang === 'ar' ? 'نسخ' : 'Duplicate'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedActivityId(act.id);
                              setViewMode('form');
                            }}
                            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'عرض وتحرير' : 'View & Edit'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ==================== ACTIVITY FORM VIEW (الأنشطة) ==================== */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* A. Status Bar & Workflow */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {actFormData.status === 'Draft' ? (
                    <button
                      type="button"
                      onClick={() => selectedActivityId && handleApproveActivity(selectedActivityId)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تعميد' : 'Approve'}</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'معمد رسمياً' : 'Approved'}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveActivity}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                  </button>

                  {selectedActivityId && (
                    <button
                      type="button"
                      onClick={() => handleDuplicateActivity(selectedActivityId)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{lang === 'ar' ? 'نسخ نشاط' : 'Duplicate Activity'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-rose-600 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                  </button>
                </div>

                {/* Workflow Status Bar Pipeline */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 bg-slate-200/80 rounded-xl text-xs font-semibold">
                    <span
                      className={`px-3 py-1 rounded-lg transition-all ${
                        actFormData.status === 'Draft'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {lang === 'ar' ? 'مسودة' : 'Draft'}
                    </span>
                    <span className="text-slate-400 px-1.5">➔</span>
                    <span
                      className={`px-3 py-1 rounded-lg transition-all ${
                        actFormData.status === 'Approved'
                          ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {lang === 'ar' ? 'مقبول' : 'Approved'}
                    </span>
                  </div>
                </div>
              </div>

              {/* B. Main Form Fields */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* النشاط (Activity Name) */}
                  {isVisible('strategic-activities', 'name') && (
                    <div className={isVisible('strategic-activities', 'source') ? 'md:col-span-2' : 'md:col-span-3'}>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'name', 'النشاط', 'Activity Name')} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lang === 'ar' ? (actFormData.name || '') : (actFormData.nameEn ?? '')}
                        onChange={(e) =>
                          setActFormData(
                            lang === 'ar'
                              ? { ...actFormData, name: e.target.value }
                              : { ...actFormData, nameEn: e.target.value, name: actFormData.name || e.target.value }
                          )
                        }
                        required
                        placeholder={lang === 'ar' ? "مثال: إطلاق مسار التمويل السريع للحرف اليدوية والفنون البصرية" : "e.g. Fast-track funding for visual arts and handicrafts"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* المصدر (Source) */}
                  {isVisible('strategic-activities', 'source') && (
                    <div className={!isVisible('strategic-activities', 'name') ? 'md:col-span-3' : ''}>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'source', 'المصدر', 'Source')}
                      </label>
                      <input
                        type="text"
                        value={translateOptionLabel(lang === 'ar' ? (actFormData.source || 'أساس') : (actFormData.sourceEn || actFormData.source || 'Base System'), lang)}
                        onChange={(e) =>
                          setActFormData(
                            lang === 'ar'
                              ? { ...actFormData, source: e.target.value }
                              : { ...actFormData, sourceEn: e.target.value }
                          )
                        }
                        placeholder={lang === 'ar' ? "أساس" : "Base System"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* البرامج (Program / Initiative Link) */}
                  {isVisible('strategic-activities', 'initiativeId') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'initiativeId', 'البرامج', 'Program / Initiative Link')} <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={actFormData.initiativeId || ''}
                        onChange={(e) => {
                          const iId = Number(e.target.value);
                          const chosenInit = initiatives.find((i) => i.id === iId);
                          setActFormData({
                            ...actFormData,
                            initiativeId: iId,
                            departmentId: chosenInit ? chosenInit.departmentId : actFormData.departmentId,
                            section: chosenInit ? chosenInit.section : actFormData.section,
                            sectionEn: chosenInit ? chosenInit.sectionEn : actFormData.sectionEn
                          });
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      >
                        {initiatives.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.code ? `[${i.code}] ` : ''}{pickLocalized(lang, i.titleEn, i.title)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* المجالات (Domains) */}
                  {isVisible('strategic-activities', 'domains') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'domains', 'المجالات', 'Domains')}
                      </label>
                      <input
                        type="text"
                        value={(lang === 'ar' ? (actFormData.domains || []) : (actFormData.domainsEn || [])).join(lang === 'ar' ? ' ، ' : ', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
                          setActFormData(
                            lang === 'ar'
                              ? { ...actFormData, domains: arr }
                              : { ...actFormData, domainsEn: arr }
                          );
                        }}
                        placeholder={lang === 'ar' ? "التمويل التنموي، الصناعات الإبداعية" : "Development Funding, Creative Industries"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* المؤشر (KPI Indicator) */}
                  {isVisible('strategic-activities', 'indicator') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'indicator', 'المؤشر', 'KPI Indicator')}
                      </label>
                      <input
                        type="text"
                        value={lang === 'ar' ? (actFormData.indicator || '') : (actFormData.indicatorEn ?? '')}
                        onChange={(e) =>
                          setActFormData(
                            lang === 'ar'
                              ? { ...actFormData, indicator: e.target.value }
                              : { ...actFormData, indicatorEn: e.target.value }
                          )
                        }
                        placeholder={lang === 'ar' ? "مثال: عدد المنشآت الصغيرة المستفيدة" : "e.g. Number of beneficiary SMEs"}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* الإدارة (Department) */}
                  {isVisible('strategic-activities', 'departmentId') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'departmentId', 'الإدارة', 'Department')}
                      </label>
                      <select
                        value={actFormData.departmentId || 1}
                        onChange={(e) => setActFormData({ ...actFormData, departmentId: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {lang === 'ar' ? d.nameAr || d.name : d.nameEn || d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* القسم (Section) */}
                  {isVisible('strategic-activities', 'section') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'section', 'القسم', 'Section')}
                      </label>
                      <input
                        type="text"
                        value={lang === 'ar' ? (actFormData.section || '') : (actFormData.sectionEn ?? '')}
                        onChange={(e) =>
                          setActFormData(
                            lang === 'ar'
                              ? { ...actFormData, section: e.target.value }
                              : { ...actFormData, sectionEn: e.target.value }
                          )
                        }
                        placeholder={lang === 'ar' ? "قسم التخطيط والمتابعة" : "Planning & Follow-up Section"}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  {/* تاريخ البدء */}
                  {isVisible('strategic-activities', 'startDate') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'startDate', 'تاريخ البدء', 'Start Date')}
                      </label>
                      <input
                        type="date"
                        value={actFormData.startDate || ''}
                        onChange={(e) => setActFormData({ ...actFormData, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}

                  {/* تاريخ الانتهاء */}
                  {isVisible('strategic-activities', 'endDate') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {getLabel('strategic-activities', 'endDate', 'تاريخ الانتهاء', 'End Date')}
                      </label>
                      <input
                        type="date"
                        value={actFormData.endDate || ''}
                        onChange={(e) => setActFormData({ ...actFormData, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  {/* مستهدف المؤشر (Indicator Target Value) */}
                  {isVisible('strategic-activities', 'targetValue') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        {getLabel('strategic-activities', 'targetValue', 'مستهدف المؤشر', 'Indicator Target Value')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={actFormData.targetValue !== undefined ? actFormData.targetValue : 0}
                          onChange={(e) => setActFormData({ ...actFormData, targetValue: Number(e.target.value) })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* قيمة النشاط (Activity Value / Budget) */}
                  {isVisible('strategic-activities', 'activityValue') && (
                    <div className={!isVisible('strategic-activities', 'targetValue') ? 'md:col-span-2' : ''}>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        {getLabel('strategic-activities', 'activityValue', 'قيمة النشاط (ريال)', 'Activity Value (SAR)')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={actFormData.activityValue !== undefined ? actFormData.activityValue : 0}
                          onChange={(e) => setActFormData({ ...actFormData, activityValue: Number(e.target.value) })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Flags / Toggles */}
                {(isVisible('strategic-activities', 'isDevelopmentalProject') || isVisible('strategic-activities', 'isExecutiveBodyActivity')) && (
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-white rounded-xl border border-slate-200">
                    {/* مشروع تنموي (Toggle Switch / Boolean) */}
                    {isVisible('strategic-activities', 'isDevelopmentalProject') && (
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(actFormData.isDevelopmentalProject)}
                          onChange={(e) => setActFormData({ ...actFormData, isDevelopmentalProject: e.target.checked })}
                          className="sr-only"
                        />
                        <div
                          className={`w-11 h-6 rounded-full transition-colors relative ${
                            actFormData.isDevelopmentalProject ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                              actFormData.isDevelopmentalProject ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          {getLabel('strategic-activities', 'isDevelopmentalProject', 'مشروع تنموي', 'Developmental Project')}
                        </span>
                      </label>
                    )}

                    {/* نشاط الهيئة التنفيذية (Checkbox / Boolean) */}
                    {isVisible('strategic-activities', 'isExecutiveBodyActivity') && (
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(actFormData.isExecutiveBodyActivity)}
                          onChange={(e) => setActFormData({ ...actFormData, isExecutiveBodyActivity: e.target.checked })}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {getLabel('strategic-activities', 'isExecutiveBodyActivity', 'نشاط الهيئة التنفيذية', 'Executive Body Activity')}
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Dynamic Custom Fields configured by Admin */}
                {getCustomFields('strategic-activities').length > 0 && (
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        {lang === 'ar' ? 'حقول إضافية مخصصة للنشاط (تم تكوينها بواسطة مدير النظام)' : 'Dynamic Custom Fields (Admin Studio)'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getCustomFields('strategic-activities').map((cf) => (
                        <div key={cf.key}>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            {lang === 'ar' ? cf.labelAr : cf.labelEn}
                            {cf.required && <span className="text-rose-500 ms-1">*</span>}
                          </label>
                          {cf.type === 'textarea' ? (
                            <textarea
                              rows={2}
                              value={actFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setActFormData({
                                  ...actFormData,
                                  customFields: {
                                    ...(actFormData.customFields || {}),
                                    [cf.key]: e.target.value
                                  }
                                })
                              }
                              placeholder={lang === 'en' ? (cf.placeholderEn || cf.placeholder || '') : (cf.placeholder || '')}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            />
                          ) : cf.type === 'select' ? (
                            <select
                              value={actFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setActFormData({
                                  ...actFormData,
                                  customFields: {
                                    ...(actFormData.customFields || {}),
                                    [cf.key]: e.target.value
                                  }
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            >
                              <option value="">{lang === 'ar' ? '-- اختر خياراً --' : '-- Select --'}</option>
                              {(cf.options || []).map((opt, idx) => (
                                <option key={opt} value={opt}>
                                  {lang === 'en' && cf.optionsEn?.[idx] ? cf.optionsEn[idx] : translateOptionLabel(opt, lang)}
                                </option>
                              ))}
                            </select>
                          ) : cf.type === 'boolean' ? (
                            <label className="flex items-center gap-2 pt-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(actFormData.customFields?.[cf.key])}
                                onChange={(e) =>
                                  setActFormData({
                                    ...actFormData,
                                    customFields: {
                                      ...(actFormData.customFields || {}),
                                      [cf.key]: e.target.checked
                                    }
                                  })
                                }
                                className="w-4 h-4 rounded text-indigo-600"
                              />
                              <span className="text-xs text-slate-700">{lang === 'ar' ? 'تفعيل' : 'Enabled'}</span>
                            </label>
                          ) : (
                            <input
                              type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                              value={actFormData.customFields?.[cf.key] || ''}
                              onChange={(e) =>
                                setActFormData({
                                  ...actFormData,
                                  customFields: {
                                    ...(actFormData.customFields || {}),
                                    [cf.key]: cf.type === 'number' ? Number(e.target.value) : e.target.value
                                  }
                                })
                              }
                              placeholder={lang === 'en' ? (cf.placeholderEn || cf.placeholder || '') : (cf.placeholder || '')}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:border-indigo-600 focus:outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* C. Chatter & Social Logging (Bottom Panel) */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="pb-3 mb-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span>{lang === 'ar' ? 'سجل التواصل والتدقيق' : 'Communication & Audit Chatter'}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {lang === 'ar' ? `${(actFormData.chatter || []).length} تدوينات مسجلة` : `${(actFormData.chatter || []).length} Logged Entries`}
                    </span>
                  </div>

                  {/* Action Mode Toggle: Send Message vs Log Note */}
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setChatterType('message')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                        chatterType === 'message'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إرسال رسالة' : 'Send Message'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChatterType('internal_note')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                        chatterType === 'internal_note'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'ملاحظة داخلية' : 'Log Note'}</span>
                    </button>
                  </div>

                  {/* Chatter Input Field */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 mb-4">
                    <textarea
                      rows={2}
                      value={chatterText}
                      onChange={(e) => setChatterText(e.target.value)}
                      placeholder={
                        chatterType === 'message'
                          ? (lang === 'ar' ? 'اكتب رسالة موجهة لفريق العمل أو الشركاء...' : 'Write a message to team members or stakeholders...')
                          : (lang === 'ar' ? 'اكتب ملاحظة داخلية خاصة لأعضاء مكتب إدارة المشاريع...' : 'Write an internal note for PMO team members...')
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-600 leading-relaxed"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {lang === 'ar' ? 'الناشر:' : 'Author:'} <strong className="text-slate-700">{resolvedUserName}</strong> ({translateRole(currentUserRole, lang)})
                      </span>
                      <button
                        type="button"
                        onClick={handlePostChatter}
                        disabled={!chatterText.trim()}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'نشر التدوينة' : 'Post Note'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Chatter Feed List */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pe-1">
                    {(actFormData.chatter || []).length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {lang === 'ar' ? 'لا توجد رسائل أو تدوينات تدقيق بعد.' : 'No chatter or audit logs yet.'}
                      </div>
                    ) : (
                      (actFormData.chatter || []).map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                            msg.type === 'internal_note'
                              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                              : msg.type === 'audit_log'
                              ? 'bg-slate-50 border-slate-200 text-slate-800'
                              : 'bg-white border-blue-100 text-slate-800 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {msg.type === 'internal_note' ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              ) : msg.type === 'audit_log' ? (
                                <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              ) : (
                                <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              )}
                              <span className="font-bold text-slate-900">{pickLocalized(lang, msg.authorEn, msg.author)}</span>
                              {msg.authorRole && (
                                <span className="text-[10px] text-slate-500 font-medium">({translateRole(msg.authorRole, lang)})</span>
                              )}
                              <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-white/80 border border-slate-200">
                                {msg.type === 'internal_note'
                                  ? (lang === 'ar' ? 'ملاحظة داخلية' : 'Internal Note')
                                  : msg.type === 'audit_log'
                                  ? (lang === 'ar' ? 'سجل تدقيق' : 'Audit Log')
                                  : (lang === 'ar' ? 'رسالة' : 'Message')}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">{msg.timestamp}</span>
                          </div>
                          <p className="leading-relaxed text-slate-700">{pickLocalized(lang, msg.contentEn, msg.content)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSPECTIVES REPORT MODAL                                                 */}
      {/* ========================================================================= */}
      {perspectivesReportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  {lang === 'ar' ? 'تقرير المناظير الاستراتيجية' : 'Strategic Perspectives Report'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPerspectivesReportOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
                {lang === 'ar' ? 'الخطة:' : 'Plan:'} <strong>{lang === 'ar' ? (planFormData.titleAr || 'الخطة الاستراتيجية المعتمدة') : (planFormData.titleEn || planFormData.titleAr || 'Approved Strategic Plan')}</strong> ({planFormData.cycle})
              </div>

              <div className="space-y-3">
                {(planFormData.perspectives || []).map((p) => {
                  const linkedGoals = (planFormData.goals || []).filter((g) => g.perspectiveId === p.id);
                  return (
                    <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{lang === 'ar' ? p.name : (p.nameEn || p.name)}</span>
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {lang === 'ar' ? 'الوزن:' : 'Weight:'} {p.weight}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(p.weight, 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                        <span>{lang === 'ar' ? 'الأهداف المرتبطة بهذا المنظور:' : 'Goals linked to this perspective:'}</span>
                        <strong className="text-slate-800">{lang === 'ar' ? `${linkedGoals.length} أهداف` : `${linkedGoals.length} Goals`}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPerspectivesReportOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق التقرير' : 'Close Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GOALS REPORT MODAL                                                        */}
      {/* ========================================================================= */}
      {goalsReportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ListOrdered className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  {lang === 'ar' ? 'تقرير الأهداف الاستراتيجية وتوزيع الأوزان' : 'Strategic Goals & Weights Distribution Report'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGoalsReportOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-start border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الرمز' : 'Code'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'الهدف الاستراتيجي' : 'Strategic Goal'}</th>
                      <th className="py-2.5 px-3 text-start">{lang === 'ar' ? 'المنظور التابع له' : 'Parent Perspective'}</th>
                      <th className="py-2.5 px-3 text-end font-mono">{lang === 'ar' ? 'الوزن' : 'Weight'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(planFormData.goals || []).map((g) => {
                      const persp = (planFormData.perspectives || []).find((p) => p.id === g.perspectiveId);
                      return (
                        <tr key={g.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{g.code || '—'}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{lang === 'ar' ? g.title : (g.titleEn || g.title)}</td>
                          <td className="py-2.5 px-3 text-slate-600">{persp ? (lang === 'ar' ? persp.name : (persp.nameEn || persp.name)) : (g.perspectiveName || '—')}</td>
                          <td className="py-2.5 px-3 text-end font-mono font-bold text-emerald-700">{g.weight}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setGoalsReportOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إغلاق التقرير' : 'Close Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
